import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import { readFile } from 'fs/promises';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// In-memory report storage (for demo; use DB for production)
const reports = {};

const browser = await puppeteer.launch({
  headless: "new"   // <- fixes the warning
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
  const { url, audits = ['accessibility'] } = req.body;
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
    // Future: Add performance, SEO, best-practices, PWA audits here
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
