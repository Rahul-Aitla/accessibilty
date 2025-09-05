import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import { readFile } from 'fs/promises';



const browser = await puppeteer.launch({
  headless: "new"   // <- fixes the warning
});

const axeSource = await readFile(
  new URL('node_modules/axe-core/axe.min.js', import.meta.url),
  'utf8'
);

const app = express();
app.use(cors());
app.use(express.json());

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
