import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import { readFile } from 'fs/promises';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['GEMINI_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Initialize Gemini AI with error handling
let genAI;
try {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  console.log('✅ Gemini AI initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Gemini AI:', error.message);
  process.exit(1);
}

// Configuration constants
const CONFIG = {
  MAX_CONCURRENT_BROWSERS: 5,
  BROWSER_TIMEOUT: 120000, // Increased to 2 minutes for slow websites
  MAX_REPORT_AGE: 24 * 60 * 60 * 1000, // 24 hours
  MAX_REPORTS_IN_MEMORY: 1000,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'https://your-frontend-domain.vercel.app'],
  PAGE_LOAD_TIMEOUT: 45000, // Maximum time to wait for page load
  NAVIGATION_TIMEOUT: 60000 // Maximum time for entire navigation process
};

// For Lighthouse audits
let lighthouse;
try {
  lighthouse = await import('lighthouse');
  console.log('✅ Lighthouse loaded successfully');
} catch (e) {
  console.warn('⚠️ Lighthouse not available:', e.message);
  lighthouse = null;
}

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (CONFIG.ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow localhost in development
    if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    console.warn(`❌ CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  maxAge: 86400 // Cache preflight for 24 hours
}));

// Security and parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON payload' });
      throw new Error('Invalid JSON');
    }
  }
}));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    originalSend.call(this, data);
  };
  
  next();
});

// Rate limiting storage (in-memory for demo)
const rateLimitStore = new Map();
const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50
};

// Rate limiting middleware
const rateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.windowMs;
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, []);
  }
  
  const requests = rateLimitStore.get(ip);
  // Remove old requests
  const validRequests = requests.filter(time => time > windowStart);
  
  if (validRequests.length >= RATE_LIMIT.maxRequests) {
    return res.status(429).json({ 
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(RATE_LIMIT.windowMs / 1000)
    });
  }
  
  validRequests.push(now);
  rateLimitStore.set(ip, validRequests);
  
  next();
};

// Apply rate limiting to scan endpoints
app.use('/api/scan', rateLimit);
app.use('/api/gemini-suggestion', rateLimit);

// In-memory report storage with cleanup (for demo; use DB for production)
const reports = new Map();

// Cleanup old reports periodically
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [id, report] of reports.entries()) {
    if (now - report.timestamp > CONFIG.MAX_REPORT_AGE) {
      reports.delete(id);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} old reports`);
  }
  
  // Also limit total reports in memory
  if (reports.size > CONFIG.MAX_REPORTS_IN_MEMORY) {
    const sortedReports = Array.from(reports.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toDelete = sortedReports.slice(0, reports.size - CONFIG.MAX_REPORTS_IN_MEMORY);
    toDelete.forEach(([id]) => reports.delete(id));
    
    console.log(`🧹 Cleaned up ${toDelete.length} excess reports`);
  }
}, 60 * 60 * 1000); // Run every hour

// Load axe-core with error handling
let axeSource;
try {
  axeSource = await readFile(
    new URL('node_modules/axe-core/axe.min.js', import.meta.url),
    'utf8'
  );
  console.log('✅ Axe-core loaded successfully');
} catch (error) {
  console.error('❌ Failed to load axe-core:', error.message);
  process.exit(1);
}

// Browser pool management
const browserPool = {
  browsers: new Set(),
  
  async createBrowser() {
    if (this.browsers.size >= CONFIG.MAX_CONCURRENT_BROWSERS) {
      throw new Error('Maximum concurrent browsers reached. Please try again later.');
    }
    
    const browser = await chromium.launch({ 
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-gpu",
        "--disable-dev-tools",
        "--no-first-run",
        "--no-zygote",
        "--deterministic-fetch",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection"
      ]
    });
    
    this.browsers.add(browser);
    
    // Auto-cleanup after timeout
    setTimeout(async () => {
      if (this.browsers.has(browser)) {
        console.warn('⚠️ Force closing browser due to timeout');
        await this.closeBrowser(browser);
      }
    }, CONFIG.BROWSER_TIMEOUT);
    
    return browser;
  },
  
  async closeBrowser(browser) {
    if (this.browsers.has(browser)) {
      this.browsers.delete(browser);
      try {
        await browser.close();
      } catch (error) {
        console.warn('⚠️ Error closing browser:', error.message);
      }
    }
  },
  
  async closeAll() {
    const browsers = Array.from(this.browsers);
    await Promise.all(browsers.map(browser => this.closeBrowser(browser)));
  }
};

// Input validation helpers
const validateUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required and must be a string' };
  }
  
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
};

const validateAudits = (audits) => {
  if (!Array.isArray(audits)) {
    return { valid: false, error: 'Audits must be an array' };
  }
  
  const validAudits = ['accessibility', 'performance', 'seo', 'best-practices', 'pwa', 'brand-color-contrast', 'dynamic-content'];
  const invalidAudits = audits.filter(audit => !validAudits.includes(audit));
  
  if (invalidAudits.length > 0) {
    return { valid: false, error: `Invalid audit types: ${invalidAudits.join(', ')}` };
  }
  
  return { valid: true };
};

const validateBrandColors = (brandColors) => {
  if (!Array.isArray(brandColors)) {
    return { valid: false, error: 'Brand colors must be an array' };
  }
  
  const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  const invalidColors = brandColors.filter(color => !hexPattern.test(color));
  
  if (invalidColors.length > 0) {
    return { valid: false, error: `Invalid hex colors: ${invalidColors.join(', ')}` };
  }
  
  return { valid: true };
};

// Enhanced report endpoints
app.post('/api/report', (req, res) => {
  try {
    const report = req.body;
    
    if (!report || typeof report !== 'object') {
      return res.status(400).json({ error: 'Invalid report data - must be an object' });
    }
    
    // Validate report structure
    const requiredFields = ['url'];
    const missingFields = requiredFields.filter(field => !report[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    
    // Validate URL in report
    const urlValidation = validateUrl(report.url);
    if (!urlValidation.valid) {
      return res.status(400).json({ error: urlValidation.error });
    }
    
    const id = crypto.randomBytes(8).toString('base64url');
    const reportWithMetadata = {
      ...report,
      id,
      timestamp: Date.now(),
      userAgent: req.headers['user-agent'] || 'Unknown',
      ip: req.ip || 'Unknown'
    };
    
    reports.set(id, reportWithMetadata);
    
    console.log(`📄 Report saved with ID: ${id} for URL: ${report.url}`);
    res.json({ id, timestamp: reportWithMetadata.timestamp });
    
  } catch (error) {
    console.error('❌ Error saving report:', error);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

app.get('/api/report/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid report ID' });
    }
    
    const report = reports.get(id);
    
    if (!report) {
      return res.status(404).json({ 
        error: 'Report not found or expired',
        message: 'Reports are automatically deleted after 24 hours'
      });
    }
    
    // Remove metadata before sending
    const { timestamp, userAgent, ip, ...cleanReport } = report;
    
    console.log(`📄 Report retrieved: ${id}`);
    res.json(cleanReport);
    
  } catch (error) {
    console.error('❌ Error retrieving report:', error);
    res.status(500).json({ error: 'Failed to retrieve report' });
  }
});

app.post('/api/scan', async (req, res) => {
  const startTime = Date.now();
  let browser = null;
  let context = null;
  
  try {
    // Input validation
    const { url, audits = ['accessibility'], brandColors = [], dynamicActions = [] } = req.body;
    
    console.log(`🔍 Starting scan for: ${url}`);
    
    // Validate URL
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      return res.status(400).json({ error: urlValidation.error });
    }
    
    // Validate audits
    const auditsValidation = validateAudits(audits);
    if (!auditsValidation.valid) {
      return res.status(400).json({ error: auditsValidation.error });
    }
    
    // Validate brand colors if provided
    if (brandColors.length > 0) {
      const colorsValidation = validateBrandColors(brandColors);
      if (!colorsValidation.valid) {
        return res.status(400).json({ error: colorsValidation.error });
      }
    }
    
    // Validate dynamic actions
    if (dynamicActions.length > 10) {
      return res.status(400).json({ 
        error: 'Too many dynamic actions. Maximum 10 allowed.' 
      });
    }
    
    // Initialize results object early
    const results = {
      url,
      timestamp: Date.now(),
      auditsRequested: audits
    };
    
    // Create browser instance
    browser = await browserPool.createBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      // Enhanced timeout settings
      timeout: CONFIG.NAVIGATION_TIMEOUT,
      navigationTimeout: CONFIG.PAGE_LOAD_TIMEOUT,
      // Disable images and fonts for faster loading (optional)
      ignoreHTTPSErrors: true, // Handle sites with SSL issues
      // Set reasonable resource limits
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const page = await context.newPage();
    
    // Set page-specific timeouts
    page.setDefaultTimeout(CONFIG.NAVIGATION_TIMEOUT);
    page.setDefaultNavigationTimeout(CONFIG.PAGE_LOAD_TIMEOUT);
    
    // Navigate with timeout and error handling - enhanced with fallback strategies
    try {
      console.log(`🌐 Attempting to load: ${url}`);
      
      // First attempt: Try with networkidle (most reliable)
      try {
        await page.goto(url, { 
          waitUntil: 'networkidle',
          timeout: 45000 // Increased from 30s to 45s
        });
        console.log(`✅ Page loaded successfully with networkidle`);
      } catch (networkIdleError) {
        console.log(`⚠️ NetworkIdle failed, trying domcontentloaded...`);
        
        // Second attempt: Try with domcontentloaded (faster)
        try {
          await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          console.log(`✅ Page loaded successfully with domcontentloaded`);
        } catch (domContentError) {
          console.log(`⚠️ DOMContentLoaded failed, trying load event...`);
          
          // Third attempt: Try with basic load event
          await page.goto(url, { 
            waitUntil: 'load',
            timeout: 20000
          });
          console.log(`✅ Page loaded successfully with load event`);
        }
      }
      
      // Additional wait for any remaining dynamic content
      await page.waitForTimeout(2000);
      
    } catch (error) {
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        throw new Error(`Website "${url}" took too long to load (tried multiple loading strategies). The site may be slow or having issues. Please try again later.`);
      } else if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
        throw new Error(`Website "${url}" not found. Please check the URL and try again.`);
      } else if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
        throw new Error(`Connection to "${url}" was refused. The website may be down or blocking automated access.`);
      } else if (error.message.includes('net::ERR_CERT_')) {
        throw new Error(`SSL certificate error for "${url}". The website may have security issues.`);
      } else if (error.message.includes('net::ERR_TOO_MANY_REDIRECTS')) {
        throw new Error(`Too many redirects when accessing "${url}". The website configuration may have issues.`);
      } else {
        throw new Error(`Failed to load website "${url}": ${error.message}`);
      }
    }
    
    // Wait for page to be fully loaded and check if it's actually accessible
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
      
      // Check if the page actually loaded content or has errors
      const pageAnalysis = await page.evaluate(() => {
        const bodyText = document.body ? document.body.innerText.trim() : '';
        const title = document.title || '';
        
        // Check for common error indicators
        const errorIndicators = [
          'error', 'exception', 'mysql', 'database', 'connection failed',
          'internal server error', '500', '404', 'not found',
          'application error', 'could not connect', 'database error'
        ];
        
        const hasError = errorIndicators.some(indicator => 
          bodyText.toLowerCase().includes(indicator.toLowerCase()) ||
          title.toLowerCase().includes(indicator.toLowerCase())
        );
        
        return {
          title,
          bodyLength: bodyText.length,
          hasContent: bodyText.length > 10,
          hasError,
          errorType: hasError ? 'Website appears to have backend/database issues' : null,
          preview: bodyText.substring(0, 200)
        };
      });
      
      if (pageAnalysis.hasError) {
        console.warn(`⚠️ Website appears to have backend issues: ${pageAnalysis.errorType}`);
        console.warn(`📄 Page content preview: "${pageAnalysis.preview}"`);
        
        // Still proceed with scan - we can analyze the error page for accessibility
        console.log(`🔍 Proceeding with accessibility scan of error page content`);
      } else if (!pageAnalysis.hasContent) {
        console.warn(`⚠️ Page appears to have loaded but contains minimal content`);
      } else {
        console.log(`📄 Page loaded successfully: "${pageAnalysis.title}" (${pageAnalysis.bodyLength} characters)`);
      }
      
      // Add website status to results
      results.websiteStatus = {
        loaded: true,
        title: pageAnalysis.title,
        contentLength: pageAnalysis.bodyLength,
        hasError: pageAnalysis.hasError,
        errorType: pageAnalysis.errorType,
        note: pageAnalysis.hasError ? 
          'Website has backend issues, but accessibility scan was performed on available content' : 
          'Website loaded successfully'
      };
      
    } catch (loadStateError) {
      console.warn(`⚠️ Load state check failed, continuing anyway:`, loadStateError.message);
      results.websiteStatus = {
        loaded: false,
        error: 'Could not verify page load state',
        note: 'Accessibility scan attempted despite load issues'
      };
    }
    
    // Update results with additional scan information
    results.audits = audits;
    results.scanDuration = null; // Will be set at the end
    
    // Run accessibility audit
    if (audits.includes('accessibility')) {
      console.log(`🔍 Running accessibility audit for: ${url}`);
      try {
        await page.addScriptTag({ content: axeSource });
        const accessibilityResult = await page.evaluate(async () => {
          return await window.axe.run(document, {
            runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
            resultTypes: ['violations']
          });
        });
        
        results.accessibility = accessibilityResult;
        
        // Add context for error pages
        if (results.websiteStatus?.hasError) {
          results.accessibility.note = 'Accessibility audit performed on error page content. Results may not represent the actual website functionality.';
          results.accessibility.recommendation = 'Fix the website backend issues first, then re-run accessibility scan on the working website.';
        }
        
        console.log(`✅ Accessibility audit completed: ${results.accessibility.violations?.length || 0} violations found`);
        
        if (results.websiteStatus?.hasError) {
          console.log(`ℹ️ Note: Scan performed on error page due to website backend issues`);
        }
        
      } catch (error) {
        console.error('❌ Accessibility audit failed:', error.message);
        results.accessibility = { 
          error: 'Failed to run accessibility audit: ' + error.message,
          violations: []
        };
      }
    }
    
    // Run dynamic content audit
    if (audits.includes('dynamic-content') && Array.isArray(dynamicActions) && dynamicActions.length > 0) {
      console.log(`🔍 Running dynamic content audit with ${dynamicActions.length} actions`);
      results.dynamicContent = [];
      
      for (let i = 0; i < dynamicActions.length; i++) {
        const action = dynamicActions[i];
        
        try {
          // Validate action structure
          if (!action.type || !action.selector) {
            results.dynamicContent.push({ 
              action, 
              error: 'Invalid action: missing type or selector' 
            });
            continue;
          }
          
          console.log(`🔍 Executing action ${i + 1}: ${action.type} on ${action.selector}`);
          
          // Execute the action
          switch (action.type) {
            case 'click':
              await page.click(action.selector, { timeout: 5000 });
              break;
            case 'focus':
              await page.focus(action.selector, { timeout: 5000 });
              break;
            case 'type':
              if (!action.value) {
                throw new Error('Type action requires a value');
              }
              await page.type(action.selector, action.value, { timeout: 5000 });
              break;
            case 'hover':
              await page.hover(action.selector, { timeout: 5000 });
              break;
            default:
              throw new Error(`Unsupported action type: ${action.type}`);
          }
          
          // Wait for potential DOM updates
          await page.waitForTimeout(1000);
          
          // Run axe-core after action
          await page.addScriptTag({ content: axeSource });
          const issues = await page.evaluate(async () => {
            return await window.axe.run(document, {
              runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
              resultTypes: ['violations']
            });
          });
          
          results.dynamicContent.push({ action, issues });
          
        } catch (error) {
          console.warn(`⚠️ Action ${i + 1} failed:`, error.message);
          results.dynamicContent.push({ 
            action, 
            error: error.message 
          });
        }
      }
      
      console.log(`✅ Dynamic content audit completed`);
    }
    
    // Run brand color contrast audit
    if (audits.includes('brand-color-contrast') && Array.isArray(brandColors) && brandColors.length > 0) {
      console.log(`🔍 Running brand color contrast audit with ${brandColors.length} colors`);
      
      try {
        results.brandColorContrast = await page.evaluate((brandColors) => {
          // Helper functions for color analysis
          function rgbToHex(rgb) {
            if (!rgb) return null;
            const result = rgb.match(/\d+/g);
            if (!result || result.length < 3) return null;
            return '#' + result
              .slice(0, 3)
              .map(x => ('0' + parseInt(x).toString(16)).slice(-2))
              .join('');
          }
          
          function luminance(r, g, b) {
            const a = [r, g, b].map(function (v) {
              v /= 255;
              return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            });
            return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
          }
          
          function contrast(rgb1, rgb2) {
            try {
              const c1 = rgb1.match(/\d+/g).map(Number);
              const c2 = rgb2.match(/\d+/g).map(Number);
              if (c1.length < 3 || c2.length < 3) return 1;
              const l1 = luminance(...c1);
              const l2 = luminance(...c2);
              return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
            } catch {
              return 1;
            }
          }
          
          // Collect all visible elements and their colors
          const all = Array.from(document.querySelectorAll('*')).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          
          const issues = [];
          const isInteractive = el => 
            ['A','BUTTON','INPUT','SELECT','TEXTAREA'].includes(el.tagName) || 
            el.tabIndex >= 0 || 
            el.hasAttribute('onclick') ||
            el.getAttribute('role') === 'button';
          
          // Analyze each element
          all.forEach(el => {
            try {
              const style = window.getComputedStyle(el);
              const color = style.color;
              const bg = style.backgroundColor;
              const colorHex = rgbToHex(color);
              const bgHex = rgbToHex(bg);
              
              // Check brand color contrast issues
              if ((brandColors.includes(colorHex) || brandColors.includes(bgHex)) && color && bg) {
                const contrastRatio = contrast(color, bg);
                const minContrast = isInteractive(el) ? 3.0 : 4.5; // WCAG AA standards
                
                if (contrastRatio < minContrast) {
                  issues.push({
                    type: 'contrast',
                    element: el.tagName.toLowerCase() + (el.className ? '.' + Array.from(el.classList).join('.') : ''),
                    selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
                    color: colorHex,
                    background: bgHex,
                    contrast: Math.round(contrastRatio * 100) / 100,
                    required: minContrast,
                    message: `Low contrast (${Math.round(contrastRatio * 100) / 100}:1) for brand color. Requires ${minContrast}:1 minimum.`,
                    isInteractive: isInteractive(el)
                  });
                }
              }
            } catch (e) {
              // Skip elements that cause errors
            }
          });
          
          // Check brand color usage patterns
          brandColors.forEach(brand => {
            let usedInteractive = false, usedNonInteractive = false;
            
            all.forEach(el => {
              try {
                const style = window.getComputedStyle(el);
                const colorHex = rgbToHex(style.color);
                const bgHex = rgbToHex(style.backgroundColor);
                
                if (colorHex === brand || bgHex === brand) {
                  if (isInteractive(el)) {
                    usedInteractive = true;
                  } else {
                    usedNonInteractive = true;
                  }
                }
              } catch (e) {
                // Skip elements that cause errors
              }
            });
            
            if (usedInteractive && usedNonInteractive) {
              issues.push({
                type: 'usage',
                brand,
                message: `Brand color ${brand} used for both interactive and non-interactive elements. Consider using different shades or additional visual cues.`
              });
            }
          });
          
          return issues;
        }, brandColors);
        
        console.log(`✅ Brand color audit completed: ${results.brandColorContrast?.length || 0} issues found`);
        
      } catch (error) {
        console.error('❌ Brand color audit failed:', error.message);
        results.brandColorContrast = [{
          type: 'error',
          message: 'Failed to analyze brand colors: ' + error.message
        }];
      }
    }
    
    // Run Lighthouse audits if requested and available
    if (lighthouse && (audits.includes('performance') || audits.includes('seo') || audits.includes('best-practices') || audits.includes('pwa'))) {
      console.log(`🔍 Running Lighthouse audits`);
      
      try {
        const wsEndpoint = browser.wsEndpoint();
        const port = new URL(wsEndpoint).port;
        const lighthouseAudits = audits.filter(a => ['performance','seo','best-practices','pwa'].includes(a));
        
        const lhResult = await lighthouse.default(url, {
          port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: lighthouseAudits,
          disableStorageReset: true,
          chromeFlags: ['--no-sandbox', '--disable-dev-shm-usage']
        });
        
        if (audits.includes('performance') && lhResult.lhr.categories.performance) {
          results.performance = {
            score: lhResult.lhr.categories.performance.score,
            metrics: {
              'first-contentful-paint': lhResult.lhr.audits['first-contentful-paint']?.numericValue,
              'largest-contentful-paint': lhResult.lhr.audits['largest-contentful-paint']?.numericValue,
              'cumulative-layout-shift': lhResult.lhr.audits['cumulative-layout-shift']?.numericValue,
              'total-blocking-time': lhResult.lhr.audits['total-blocking-time']?.numericValue
            }
          };
        }
        
        if (audits.includes('seo') && lhResult.lhr.categories.seo) {
          results.seo = {
            score: lhResult.lhr.categories.seo.score,
            issues: Object.values(lhResult.lhr.audits)
              .filter(audit => audit.scoreDisplayMode === 'binary' && audit.score === 0)
              .map(audit => ({
                id: audit.id,
                title: audit.title,
                description: audit.description
              }))
          };
        }
        
        if (audits.includes('best-practices') && lhResult.lhr.categories['best-practices']) {
          results['best-practices'] = {
            score: lhResult.lhr.categories['best-practices'].score,
            issues: Object.values(lhResult.lhr.audits)
              .filter(audit => audit.scoreDisplayMode === 'binary' && audit.score === 0)
              .map(audit => ({
                id: audit.id,
                title: audit.title,
                description: audit.description
              }))
          };
        }
        
        if (audits.includes('pwa') && lhResult.lhr.categories.pwa) {
          results.pwa = {
            score: lhResult.lhr.categories.pwa.score,
            installable: lhResult.lhr.audits['installable-manifest']?.score === 1,
            hasServiceWorker: lhResult.lhr.audits['service-worker']?.score === 1
          };
        }
        
        console.log(`✅ Lighthouse audits completed`);
        
      } catch (error) {
        console.error('❌ Lighthouse audit failed:', error.message);
        const failedAudits = audits.filter(a => ['performance','seo','best-practices','pwa'].includes(a));
        failedAudits.forEach(audit => {
          results[audit] = { 
            error: 'Lighthouse audit failed: ' + error.message,
            score: null 
          };
        });
      }
    }
    
    // Calculate total scan duration
    results.scanDuration = Date.now() - startTime;
    
    await context.close();
    await browserPool.closeBrowser(browser);
    browser = null;
    
    console.log(`✅ Scan completed for ${url} in ${results.scanDuration}ms`);
    
    // Send successful response
    res.json(results);
    
  } catch (error) {
    console.error(`❌ Scan failed for ${req.body.url || 'unknown URL'}:`, error.message);
    
    // Cleanup browser and context if still exists
    if (context) {
      try {
        await context.close();
      } catch (e) {
        console.warn('⚠️ Error closing context:', e.message);
      }
    }
    if (browser) {
      await browserPool.closeBrowser(browser);
    }
    
    // Send appropriate error response
    let statusCode = 500;
    let errorMessage = 'Internal server error during scan';
    
    if (error.message.includes('timeout') || error.message.includes('took too long')) {
      statusCode = 408;
      errorMessage = 'Website took too long to respond. Please try again.';
    } else if (error.message.includes('not found') || error.message.includes('ERR_NAME_NOT_RESOLVED')) {
      statusCode = 404;
      errorMessage = 'Website not found. Please check the URL.';
    } else if (error.message.includes('refused') || error.message.includes('ERR_CONNECTION_REFUSED')) {
      statusCode = 503;
      errorMessage = 'Website is not accessible. It may be down or blocking automated requests.';
    } else if (error.message.includes('Maximum concurrent browsers')) {
      statusCode = 503;
      errorMessage = 'Server is busy. Please try again in a few moments.';
    } else if (error.message.includes('Invalid')) {
      statusCode = 400;
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: Date.now(),
      scanDuration: Date.now() - startTime
    });
  }
});

// Enhanced Gemini AI suggestion endpoint
app.post('/api/gemini-suggestion', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { url, scanResult, message } = req.body;
    
    // Input validation
    if (!url && !message) {
      return res.status(400).json({ 
        error: 'Either URL or message is required' 
      });
    }
    
    if (url) {
      const urlValidation = validateUrl(url);
      if (!urlValidation.valid) {
        return res.status(400).json({ error: urlValidation.error });
      }
    }
    
    if (message && (typeof message !== 'string' || message.length > 1000)) {
      return res.status(400).json({ 
        error: 'Message must be a string with maximum 1000 characters' 
      });
    }
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'AI service is currently unavailable',
        message: 'The AI suggestion feature requires proper configuration.'
      });
    }

    console.log(`🤖 Generating AI suggestion for: ${url || 'user message'}`);

    // Try different model names in order of preference
    const modelNames = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
    let model;
    let lastError;

    for (const modelName of modelNames) {
      try {
        model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        });
        console.log(`✅ Using Gemini model: ${modelName}`);
        break;
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ Failed to load model ${modelName}:`, err.message);
      }
    }

    if (!model) {
      return res.status(500).json({ 
        error: 'AI service is temporarily unavailable',
        details: process.env.NODE_ENV === 'development' ? lastError?.message : undefined
      });
    }
    
    // Sanitize and prepare scan result data
    let sanitizedScanResult = null;
    if (scanResult && typeof scanResult === 'object') {
      try {
        // Limit the size of scan result data to prevent token overflow
        const scanDataString = JSON.stringify(scanResult);
        if (scanDataString.length > 5000) {
          // Truncate large scan results
          sanitizedScanResult = {
            url: scanResult.url,
            timestamp: scanResult.timestamp,
            accessibility: {
              violations: scanResult.accessibility?.violations?.slice(0, 10) || []
            },
            summary: `Scan data truncated due to size. ${scanResult.accessibility?.violations?.length || 0} total violations found.`
          };
        } else {
          sanitizedScanResult = scanResult;
        }
      } catch (error) {
        console.warn('⚠️ Failed to process scan result:', error.message);
        sanitizedScanResult = null;
      }
    }
    
    let prompt;
    if (message) {
      // User asked a specific question
      prompt = `You are a friendly accessibility expert assistant. Answer this question about web accessibility in a conversational, helpful way: "${message}"

${sanitizedScanResult ? `Context from recent website scan of "${url}": ${JSON.stringify(sanitizedScanResult, null, 2)}` : ''}

Guidelines for your response:
- Keep it under 150 words
- Be practical and actionable
- Use easy-to-understand language
- Maintain a friendly, encouraging tone
- Focus on solutions, not just problems
- If scan data is available, reference specific findings when relevant`;

    } else {
      // Auto-generate suggestions based on scan results
      const violationCount = sanitizedScanResult?.accessibility?.violations?.length || 0;
      const hasWebsiteError = sanitizedScanResult?.websiteStatus?.hasError;
      
      if (hasWebsiteError) {
        prompt = `You are a helpful web accessibility and technical assistant. The website scan shows that this website has backend/database issues (the site is showing error pages instead of normal content).

Website: ${url}
Issue: ${sanitizedScanResult?.websiteStatus?.errorType || 'Backend/database connection problems'}

Please provide advice in this format:
🚨 **Primary Issue:** [Explain the backend problem]
🔧 **Technical Fixes:**
• [Database/server issue resolution]
• [Infrastructure recommendations]

♿ **Accessibility Note:** [Brief note about accessibility scanning error pages]

Requirements:
- Keep under 200 words total
- Focus on the backend/infrastructure issues first
- Mention that accessibility should be tested after fixing the primary issues
- Be helpful and professional`;
      } else {
        prompt = `You are a helpful accessibility assistant. Analyze this website scan and provide 3-4 quick, actionable tips to improve accessibility.

Website: ${url}
${sanitizedScanResult ? `Scan results: ${JSON.stringify(sanitizedScanResult, null, 2)}` : ''}

Format your response exactly like this:
🔧 **Quick Fixes:**
• [Specific, actionable item based on scan results]
• [Specific, actionable item based on scan results]
• [Specific, actionable item based on scan results]

💡 **Why it matters:** [Brief, encouraging explanation of accessibility impact]

Requirements:
- Keep total response under 200 words
- Be specific to the actual issues found
- Provide practical implementation steps
- Use encouraging, supportive language
- Focus on the most impactful improvements first`;
      }
    }

    // Generate content with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI request timeout')), 30000);
    });
    
    const generatePromise = model.generateContent(prompt);
    
    const result = await Promise.race([generatePromise, timeoutPromise]);
    const response = await result.response;
    const suggestion = response.text();

    // Validate response
    if (!suggestion || suggestion.trim().length === 0) {
      throw new Error('Empty response from AI service');
    }

    // Log successful generation
    const duration = Date.now() - startTime;
    console.log(`✅ AI suggestion generated in ${duration}ms (${suggestion.length} characters)`);

    res.json({ 
      suggestion: suggestion.trim(), 
      url: url || null,
      timestamp: Date.now(),
      processingTime: duration,
      model: model.model || 'unknown'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Gemini API error (${duration}ms):`, error.message);
    
    // Provide more specific error messages
    let statusCode = 500;
    let errorMessage = 'Failed to generate AI suggestion';
    
    if (error.message.includes('API_KEY_INVALID') || error.message.includes('invalid api key')) {
      statusCode = 500;
      errorMessage = 'AI service configuration error. Please contact support.';
    } else if (error.message.includes('QUOTA_EXCEEDED') || error.message.includes('quota')) {
      statusCode = 503;
      errorMessage = 'AI service is temporarily unavailable due to high demand. Please try again later.';
    } else if (error.message.includes('models/') || error.message.includes('not found')) {
      statusCode = 503;
      errorMessage = 'AI service model is temporarily unavailable. Please try again later.';
    } else if (error.message.includes('timeout')) {
      statusCode = 408;
      errorMessage = 'AI service took too long to respond. Please try again.';
    } else if (error.message.includes('SAFETY') || error.message.includes('blocked')) {
      statusCode = 400;
      errorMessage = 'Request was blocked by content safety filters. Please rephrase your question.';
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: Date.now(),
      processingTime: duration
    });
  }
});

// Quick website availability check endpoint
app.post('/api/check-website', async (req, res) => {
  let browser = null;
  let context = null;
  
  try {
    const { url } = req.body;
    
    // Validate URL
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      return res.status(400).json({ error: urlValidation.error });
    }
    
    console.log(`🌐 Quick check for: ${url}`);
    
    browser = await browserPool.createBrowser();
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    
    // Quick navigation test
    const startTime = Date.now();
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    const loadTime = Date.now() - startTime;
    
    // Quick content analysis
    const analysis = await page.evaluate(() => {
      const title = document.title || 'No title';
      const bodyText = document.body ? document.body.innerText.trim() : '';
      
      const errorIndicators = [
        'error', 'exception', 'mysql', 'database', 'connection failed',
        'internal server error', '500', '404', 'not found',
        'application error', 'could not connect'
      ];
      
      const hasError = errorIndicators.some(indicator => 
        bodyText.toLowerCase().includes(indicator.toLowerCase()) ||
        title.toLowerCase().includes(indicator.toLowerCase())
      );
      
      return {
        title,
        hasContent: bodyText.length > 50,
        hasError,
        contentPreview: bodyText.substring(0, 150),
        hasImages: document.images.length > 0,
        hasLinks: document.links.length > 0
      };
    });
    
    await context.close();
    await browserPool.closeBrowser(browser);
    
    const status = analysis.hasError ? 'error' : 
                  analysis.hasContent ? 'healthy' : 'minimal_content';
    
    console.log(`✅ Website check completed: ${status} (${loadTime}ms)`);
    
    res.json({
      url,
      status,
      accessible: !analysis.hasError,
      loadTime,
      details: {
        title: analysis.title,
        hasContent: analysis.hasContent,
        hasError: analysis.hasError,
        contentPreview: analysis.contentPreview,
        hasImages: analysis.hasImages,
        hasLinks: analysis.hasLinks
      },
      recommendation: analysis.hasError ? 
        'Website has backend issues. Fix server/database problems before running accessibility scan.' :
        analysis.hasContent ?
        'Website is accessible and ready for accessibility scanning.' :
        'Website loads but has minimal content. Scan results may be limited.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ Website check failed for ${req.body.url}:`, error.message);
    
    if (context) {
      try { await context.close(); } catch (e) {}
    }
    if (browser) {
      await browserPool.closeBrowser(browser);
    }
    
    let status = 'unreachable';
    let message = 'Website could not be reached';
    
    if (error.message.includes('timeout')) {
      status = 'slow';
      message = 'Website is too slow to respond';
    } else if (error.message.includes('ERR_NAME_NOT_RESOLVED')) {
      status = 'not_found';
      message = 'Website domain not found';
    }
    
    res.json({
      url: req.body.url,
      status,
      accessible: false,
      error: message,
      recommendation: 'Check the URL and ensure the website is online before scanning.',
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint for validating browser functionality
app.get('/api/test-browser', async (req, res) => {
  let browser = null;
  let context = null;
  
  try {
    console.log('🧪 Testing browser functionality...');
    
    browser = await browserPool.createBrowser();
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    
    // Test with a reliable fast-loading site
    await page.goto('https://httpbin.org/html', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    const title = await page.title();
    const content = await page.evaluate(() => document.body.innerText.length);
    
    await context.close();
    await browserPool.closeBrowser(browser);
    
    console.log('✅ Browser test successful');
    
    res.json({
      status: 'success',
      message: 'Browser functionality test passed',
      details: {
        title,
        contentLength: content,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Browser test failed:', error.message);
    
    if (context) {
      try { await context.close(); } catch (e) {}
    }
    if (browser) {
      await browserPool.closeBrowser(browser);
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Browser functionality test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    environment: process.env.NODE_ENV || 'development',
    services: {
      geminiAI: !!process.env.GEMINI_API_KEY,
      lighthouse: !!lighthouse,
      axeCore: !!axeSource
    },
    activeBrowsers: browserPool.browsers.size,
    reportsInMemory: reports.size
  };
  
  res.json(healthData);
});

// API information endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Accessibility Analyzer API',
    version: '1.0.0',
    description: 'Comprehensive web accessibility analysis with AI-powered suggestions',
    endpoints: {
      'POST /api/scan': 'Run accessibility, performance, and other audits on a website',
      'POST /api/check-website': 'Quick check if a website is accessible and working',
      'POST /api/report': 'Save a report and get a shareable ID',
      'GET /api/report/:id': 'Retrieve a saved report by ID',
      'POST /api/gemini-suggestion': 'Get AI-powered accessibility suggestions',
      'GET /api/test-browser': 'Test browser functionality (for debugging)',
      'GET /health': 'Server health and status information',
      'GET /api': 'API documentation (this endpoint)'
    },
    documentation: 'https://github.com/your-username/accessibility-analyzer',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Accessibility Analyzer API',
    status: 'running',
    timestamp: new Date().toISOString(),
    documentation: '/api'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(`❌ Unhandled error on ${req.method} ${req.path}:`, error);
  
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    timestamp: Date.now(),
    path: req.path
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} is not a valid API endpoint`,
    availableEndpoints: [
      'GET /',
      'GET /api',
      'GET /health',
      'GET /api/test-browser',
      'POST /api/scan',
      'POST /api/check-website',
      'POST /api/report',
      'GET /api/report/:id',
      'POST /api/gemini-suggestion'
    ],
    timestamp: Date.now()
  });
});

// Server startup
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ===================================');
  console.log(`🚀 Accessibility Analyzer API started`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 Node.js: ${process.version}`);
  console.log(`🚀 Time: ${new Date().toISOString()}`);
  console.log('🚀 ===================================');
  console.log('');
  console.log('✅ Services initialized:');
  console.log(`   • Gemini AI: ${process.env.GEMINI_API_KEY ? '✅' : '❌'}`);
  console.log(`   • Lighthouse: ${lighthouse ? '✅' : '❌'}`);
  console.log(`   • Axe-core: ${axeSource ? '✅' : '❌'}`);
  console.log(`   • Browser Pool: ✅ (max ${CONFIG.MAX_CONCURRENT_BROWSERS})`);
  console.log('');
  console.log('🌐 API Endpoints:');
  console.log(`   • Health: http://localhost:${PORT}/health`);
  console.log(`   • Documentation: http://localhost:${PORT}/api`);
  console.log(`   • Scan: POST http://localhost:${PORT}/api/scan`);
  console.log('');
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  // Stop accepting new requests
  server.close(async () => {
    console.log('🛑 HTTP server closed');
    
    try {
      // Close all browsers
      await browserPool.closeAll();
      console.log('🛑 All browsers closed');
      
      // Clear reports
      reports.clear();
      console.log('🛑 Reports cleared');
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});
