# Accessibility Analyzer Server

A comprehensive backend API for web accessibility analysis, powered by Playwright, axe-core, and Gemini AI.

## 🚀 Features

- **Web Accessibility Auditing**: Complete WCAG 2.1 AA compliance checking using axe-core
- **Performance Analysis**: Lighthouse integration for performance, SEO, and best practices audits
- **Brand Color Analysis**: Custom brand color contrast and usage pattern detection
- **Dynamic Content Testing**: Simulate user interactions and test accessibility after state changes
- **AI-Powered Suggestions**: Gemini AI integration for contextual accessibility recommendations
- **Report Sharing**: Generate shareable links for audit results
- **Production Ready**: Comprehensive error handling, rate limiting, and graceful shutdown

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Browser Automation**: Playwright (Chromium)
- **Accessibility Testing**: axe-core
- **Performance Testing**: Lighthouse
- **AI Integration**: Google Generative AI (Gemini)
- **Deployment**: Render.com

## 📋 Prerequisites

- Node.js 18 or higher
- Gemini API key (free from [Google AI Studio](https://makersuite.google.com/app/apikey))

## 🔧 Installation

1. **Clone and navigate to server directory**
   ```bash
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browser**
   ```bash
   npx playwright install chromium
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your Gemini API key
   ```

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🌐 API Endpoints

### Health Check
```http
GET /health
```
Returns server status and service availability.

### Scan Website
```http
POST /api/scan
```
**Body:**
```json
{
  "url": "https://example.com",
  "audits": ["accessibility", "performance", "brand-color-contrast"],
  "brandColors": ["#ff0000", "#00ff00"],
  "dynamicActions": [
    {"type": "click", "selector": ".menu-toggle"},
    {"type": "type", "selector": "#search", "value": "test"}
  ]
}
```

**Supported Audits:**
- `accessibility`: WCAG 2.1 AA compliance check
- `performance`: Lighthouse performance audit
- `seo`: SEO best practices audit
- `best-practices`: Web best practices audit
- `pwa`: Progressive Web App audit
- `brand-color-contrast`: Custom brand color analysis
- `dynamic-content`: Test accessibility after user interactions

### Save Report
```http
POST /api/report
```
Save scan results and get a shareable ID.

### Get Report
```http
GET /api/report/:id
```
Retrieve saved report by ID.

### AI Suggestions
```http
POST /api/gemini-suggestion
```
**Body:**
```json
{
  "url": "https://example.com",
  "scanResult": { /* scan data */ },
  "message": "How can I improve color contrast?"
}
```

## 🔒 Security Features

- **CORS Protection**: Configurable allowed origins
- **Rate Limiting**: 50 requests per 15 minutes per IP
- **Input Validation**: Comprehensive request validation
- **Browser Isolation**: Secure browser pool management
- **Memory Management**: Automatic cleanup of resources

## 📊 Performance Optimizations

- **Browser Pool**: Efficient browser instance management
- **Memory Cleanup**: Automatic report expiration and cleanup
- **Request Timeout**: 30-second timeout for all operations
- **Concurrent Limits**: Maximum 5 concurrent browser instances

## 🚀 Deployment

### Render.com (Recommended)

1. **Connect your repository to Render**
2. **Use the provided `render.yaml` configuration**
3. **Set environment variables:**
   - `GEMINI_API_KEY`: Your Gemini API key
   - `ALLOWED_ORIGINS`: Your frontend domain
4. **Deploy**: Automatic deployment on git push

### Manual Deployment

1. **Set environment variables**
   ```bash
   export NODE_ENV=production
   export GEMINI_API_KEY=your_api_key
   export ALLOWED_ORIGINS=https://yourdomain.com
   ```

2. **Install production dependencies**
   ```bash
   npm ci --production
   npx playwright install chromium --with-deps
   ```

3. **Start the server**
   ```bash
   node index.js
   ```

## 🧪 Testing

```bash
# Test the health endpoint
curl http://localhost:4000/health

# Test a basic scan
curl -X POST http://localhost:4000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "audits": ["accessibility"]}'
```

## 📝 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI suggestions |
| `PORT` | No | Server port (default: 4000) |
| `NODE_ENV` | No | Environment (development/production) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

## 🔧 Configuration

The server includes several configurable limits:

```javascript
const CONFIG = {
  MAX_CONCURRENT_BROWSERS: 5,    // Maximum simultaneous browser instances
  BROWSER_TIMEOUT: 60000,        // Browser auto-cleanup timeout (ms)
  MAX_REPORT_AGE: 24 * 60 * 60 * 1000,  // Report expiration (24 hours)
  MAX_REPORTS_IN_MEMORY: 1000    // Maximum stored reports
};
```

## 🐛 Troubleshooting

### Common Issues

**Browser installation fails:**
```bash
# Install system dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libgtk-3-0 libgbm1

# Then reinstall Playwright
npx playwright install chromium --with-deps
```

**Gemini API errors:**
- Verify your API key is correct
- Check API quota limits
- Ensure the key has proper permissions

**Memory issues:**
- Reduce `MAX_CONCURRENT_BROWSERS`
- Increase server memory allocation
- Monitor browser cleanup logs

### Debug Mode

Set `NODE_ENV=development` for detailed error messages and debug logs.

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review server logs for error details
