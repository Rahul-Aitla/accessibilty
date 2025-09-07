import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import { readFile } from 'fs/promises';
import crypto from 'crypto';

// For Lighthouse audits
let lighthouse;
try {
  lighthouse = await import('lighthouse');
} catch (e) {
  lighthouse = null;
}

const app = express();
app.use(cors());
app.use(express.json());

// In-memory report storage (for demo; use DB for production)
const reports = {};

const browser = await puppeteer.launch({
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--single-process",
    "--disable-gpu"
  ]
});

const axeSource = await readFile(
  new URL('node_modules/axe-core/axe.min.js', import.meta.url),
  'utf8'
);

// Save a report and return a short id
app.post('/api/report', (req, res) => {
  const report = req.body;
  if (!report || typeof report !== 'object') {
    return res.status(400).json({ error: 'Invalid report data' });
  }
  const id = crypto.randomBytes(6).toString('base64url');
  reports[id] = report;
  res.json({ id });
});

// Retrieve a report by id
app.get('/api/report/:id', (req, res) => {
  const { id } = req.params;
  const report = reports[id];
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  res.json(report);
});

app.post('/api/scan', async (req, res) => {
  const { url, audits = ['accessibility'], brandColors = [], dynamicActions = [] } = req.body;
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  let browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const results = {};
    if (audits.includes('accessibility')) {
      await page.addScriptTag({ content: axeSource });
      results.accessibility = await page.evaluate(async () => {
        return await window.axe.run(document, {
          runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
          resultTypes: ['violations']
        });
      });
    }
    // Dynamic content audit: simulate actions and run axe after each
    if (audits.includes('dynamic-content') && Array.isArray(dynamicActions) && dynamicActions.length > 0) {
      results.dynamicContent = [];
      for (const action of dynamicActions) {
        // action: {type: 'click'|'focus'|'type', selector: string, value?: string}
        try {
          if (action.type === 'click') {
            await page.click(action.selector);
          } else if (action.type === 'focus') {
            await page.focus(action.selector);
          } else if (action.type === 'type') {
            await page.type(action.selector, action.value || '');
          }
          // Wait for possible DOM updates
          await page.waitForTimeout(500);
          // Run axe-core after action
          await page.addScriptTag({ content: axeSource });
          const issues = await page.evaluate(() => {
            return window.axe.run(document, {
              runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
              resultTypes: ['violations']
            });
          });
          results.dynamicContent.push({ action, issues });
        } catch (e) {
          results.dynamicContent.push({ action, error: e.message });
        }
      }
    }
    // Custom brand color contrast and color usage audit
    if (audits.includes('brand-color-contrast') && Array.isArray(brandColors) && brandColors.length > 0) {
      results['brandColorContrast'] = await page.evaluate((brandColors) => {
        // Helper: get computed color in hex
        function rgbToHex(rgb) {
          if (!rgb) return null;
          const result = rgb.match(/\d+/g);
          if (!result) return null;
          return (
            '#' +
            result
              .slice(0, 3)
              .map(x => ('0' + parseInt(x).toString(16)).slice(-2))
              .join('')
          );
        }
        // Helper: contrast ratio (WCAG)
        function luminance(r, g, b) {
          const a = [r, g, b].map(function (v) {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
        }
        function contrast(rgb1, rgb2) {
          const c1 = rgb1.match(/\d+/g).map(Number);
          const c2 = rgb2.match(/\d+/g).map(Number);
          const l1 = luminance(...c1);
          const l2 = luminance(...c2);
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        }
        // Collect all elements and their colors
        const all = Array.from(document.querySelectorAll('*'));
        const issues = [];
        const interactive = el => ['A','BUTTON','INPUT','SELECT','TEXTAREA'].includes(el.tagName) || el.tabIndex >= 0;
        all.forEach(el => {
          const style = window.getComputedStyle(el);
          const color = style.color;
          const bg = style.backgroundColor;
          const colorHex = rgbToHex(color);
          const bgHex = rgbToHex(bg);
          // 1. Brand color contrast issues
          if (brandColors.includes(colorHex) || brandColors.includes(bgHex)) {
            // Check contrast
            if (color && bg && contrast(color, bg) < 4.5) {
              issues.push({
                type: 'contrast',
                element: el.outerHTML.slice(0, 200),
                color: colorHex,
                background: bgHex,
                contrast: contrast(color, bg),
                msg: `Low contrast for brand color (${colorHex} on ${bgHex})`,
              });
            }
          }
        });
        // 2. Brand color used for both interactive & non-interactive
        brandColors.forEach(brand => {
          let usedInteractive = false, usedNonInteractive = false;
          all.forEach(el => {
            const style = window.getComputedStyle(el);
            const colorHex = rgbToHex(style.color);
            const bgHex = rgbToHex(style.backgroundColor);
            if (colorHex === brand || bgHex === brand) {
              if (interactive(el)) usedInteractive = true;
              else usedNonInteractive = true;
            }
          });
          if (usedInteractive && usedNonInteractive) {
            issues.push({
              type: 'usage',
              brand,
              msg: `Brand color ${brand} used for both interactive and non-interactive elements.`
            });
          }
        });
        return issues;
      }, brandColors);
    }
    // Add Lighthouse audits if requested and available
    if (lighthouse && (audits.includes('performance') || audits.includes('seo') || audits.includes('best-practices') || audits.includes('pwa'))) {
      const port = new URL(page.browser().wsEndpoint()).port;
      const lhResult = await lighthouse.default(url, {
        port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: audits.filter(a => ['performance','seo','best-practices','pwa'].includes(a)),
        disableStorageReset: true
      });
      if (audits.includes('performance')) results.performance = lhResult.lhr.categories.performance;
      if (audits.includes('seo')) results.seo = lhResult.lhr.categories.seo;
      if (audits.includes('best-practices')) results['best-practices'] = lhResult.lhr.categories['best-practices'];
      if (audits.includes('pwa')) results.pwa = lhResult.lhr.categories.pwa;
    }
    await browser.close();
    res.json(results);
  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('Accessibility Analyzer API');
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
