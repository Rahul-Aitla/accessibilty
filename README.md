# 🌐 Accessibility Audit System

A comprehensive web accessibility analysis tool that provides professional-grade auditing capabilities for websites, including WCAG compliance, performance analysis, SEO optimization, and brand-specific accessibility testing.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green.svg)
![React](https://img.shields.io/badge/react-18.2-blue.svg)
![Express](https://img.shields.io/badge/express-4.18-lightgrey.svg)

## 🚀 Features

### 🎯 Core Audit Capabilities
- **Accessibility Testing** - WCAG 2.0/2.1 Level A & AA compliance using axe-core
- **Performance Analysis** - Core Web Vitals and Lighthouse performance metrics
- **SEO Optimization** - Search engine optimization analysis and recommendations
- **Best Practices** - Security, modern web standards, and code quality assessment
- **PWA Compliance** - Progressive Web App capabilities and installability
- **Brand Color Contrast** - Custom brand-specific accessibility analysis
- **Dynamic Content Testing** - User interaction accessibility validation

### 🛠️ Advanced Features
- **Multi-Strategy Page Loading** - Handles slow and problematic websites
- **Website Status Detection** - Identifies backend errors and database issues
- **Real-time Progress Tracking** - Live scan progress with detailed logging
- **Error Recovery** - Graceful handling of broken websites and timeouts
- **Browser Pool Management** - Efficient resource utilization and stability
- **Rate Limiting** - API protection and resource management

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [System Architecture](#-system-architecture)
- [Frontend Application](#-frontend-application)
- [Backend API](#-backend-api)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm 8+
- Modern web browser
- 4GB+ RAM recommended

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Rahul-Aitla/accessibilty.git
cd accessibilty
```

2. **Setup Backend**
```bash
cd server
npm install
cp .env.example .env
# Configure your environment variables
npm start
```

3. **Setup Frontend**
```bash
cd ../access
npm install
npm run dev
```

4. **Access the application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- Health Check: http://localhost:4000/health

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │  Browser Pool   │
│   (React/Vite)  │───▶│  (Node/Express)│───▶│   (Playwright)  │
│                 │    │                 │    │                 │
│ • User Interface│    │ • Audit Engine  │    │ • Web Scraping  │
│ • Results View  │    │ • AI Analysis   │    │ • axe-core      │
│ • Progress Track│    │ • Rate Limiting │    │ • Lighthouse    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │              ┌─────────────────┐              │
        └────────────▶│  External APIs  │◀─────────────┘
                       │                 │
                       │ • Google Gemini │
                       │ • Lighthouse    │
                       └─────────────────┘
```

## 🎨 Frontend Application

### Technology Stack
- **Framework**: React 18.2 with Hooks
- **Build Tool**: Vite 5.0 for fast development and optimized builds
- **Styling**: Tailwind CSS 3.4 for utility-first styling
- **State Management**: React useState and useEffect hooks
- **HTTP Client**: Fetch API with error handling

### Key Components

#### `AccessibilityForm.jsx`
Main interface component handling:
- URL input and validation
- Audit option selection
- Website health checking
- Scan progress tracking
- Error handling and user feedback

#### `ResultsDashboard.jsx`
Results visualization component featuring:
- Interactive audit results display
- Detailed violation breakdowns
- Performance metrics visualization
- Downloadable reports
- Progress indicators

#### `ThemeToggle.jsx`
Accessibility-focused theme switcher:
- Light/dark mode toggle
- High contrast options
- User preference persistence
- WCAG compliant color schemes

#### `AuditOptions.jsx`
Audit configuration interface:
- Multiple audit type selection
- Brand color input
- Dynamic action configuration
- Advanced options panel

### Frontend Features

**🔍 Real-time Scanning**
```javascript
// Website health check before scanning
const checkWebsite = async (url) => {
  try {
    const response = await fetch('/api/check-website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    return await response.json();
  } catch (error) {
    return { accessible: false, error: error.message };
  }
};
```

**📊 Progress Tracking**
- Real-time scan progress updates
- Estimated completion times
- Detailed step-by-step logging
- Error recovery notifications

**🎨 Responsive Design**
- Mobile-first responsive layout
- Touch-friendly interface elements
- Accessibility-compliant color schemes
- High contrast mode support

### Build & Development

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Linting
npm run lint
```

## ⚙️ Backend API

### Technology Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18
- **Browser Automation**: Playwright (Chromium)
- **Accessibility Testing**: axe-core 4.8
- **Performance Testing**: Lighthouse (when available)
- **AI Integration**: Google Generative AI
- **Process Management**: Graceful shutdown handling

### Core Modules

#### Audit Engine
```javascript
// Multi-strategy page loading
const loadStrategies = [
  { waitUntil: 'networkidle', timeout: 30000 },
  { waitUntil: 'domcontentloaded', timeout: 20000 },
  { waitUntil: 'load', timeout: 15000 }
];
```

#### Browser Pool Management
- Automated browser lifecycle management
- Memory leak prevention
- Resource cleanup and optimization
- Error recovery and retry logic

#### AI-Powered Analysis
```javascript
// Gemini AI integration for detailed analysis
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.3,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
  }
});
```

### API Endpoints

#### `POST /api/scan`
Main scanning endpoint for comprehensive website analysis.

**Request Body:**
```json
{
  "url": "https://example.com",
  "audits": ["accessibility", "performance", "seo"],
  "brandColors": ["#FF0000", "#00FF00"],
  "dynamicActions": [
    {
      "type": "click",
      "selector": "#menu-button",
      "description": "Open navigation menu"
    }
  ]
}
```

**Response:**
```json
{
  "url": "https://example.com",
  "timestamp": 1694188800000,
  "scanDuration": 15340,
  "websiteStatus": {
    "loaded": true,
    "title": "Example Website",
    "hasError": false
  },
  "accessibility": {
    "violations": [...],
    "passes": [...],
    "incomplete": [...]
  },
  "performance": {
    "score": 0.85,
    "metrics": {...}
  },
  "seo": {
    "score": 0.92,
    "issues": [...]
  }
}
```

#### `POST /api/check-website`
Website availability and health check endpoint.

**Request Body:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "accessible": true,
  "status": "healthy",
  "title": "Example Website",
  "loadTime": 1200,
  "note": "Website is accessible and ready for scanning"
}
```

#### `GET /health`
Server health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1694188800000,
  "uptime": 3600,
  "memory": {
    "used": "245 MB",
    "total": "512 MB"
  },
  "browserPool": {
    "active": 2,
    "available": 8
  }
}
```

### Advanced Features

#### Website Status Detection
```javascript
// Intelligent error page detection
const analyzePageContent = async (page) => {
  return await page.evaluate(() => {
    const title = document.title;
    const bodyText = document.body.innerText.toLowerCase();
    
    const errorIndicators = [
      'database error', 'connection failed', 'internal server error',
      '500', '404', 'not found', 'application error'
    ];
    
    const hasError = errorIndicators.some(indicator => 
      bodyText.includes(indicator) || title.toLowerCase().includes(indicator)
    );
    
    return {
      title,
      bodyLength: bodyText.length,
      hasError,
      errorType: hasError ? 'backend_error' : null
    };
  });
};
```

#### Brand Color Contrast Analysis
```javascript
// Custom WCAG contrast ratio calculation
function contrastRatio(color1, color2) {
  const l1 = relativeLuminance(color1);
  const l2 = relativeLuminance(color2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
```

#### Dynamic Content Testing
```javascript
// User interaction simulation
const actions = [
  { type: 'click', selector: '#menu-button' },
  { type: 'type', selector: '#search', value: 'test query' },
  { type: 'hover', selector: '.dropdown-trigger' }
];

for (const action of actions) {
  await executeAction(page, action);
  await page.waitForTimeout(1000);
  const issues = await runAxeAudit(page);
  results.push({ action, issues });
}
```

## 🔧 Configuration

### Environment Variables

#### Backend Configuration (`.env`)
```bash
# Server Configuration
PORT=4000
NODE_ENV=production

# AI Integration
GEMINI_API_KEY=your_gemini_api_key_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Browser Configuration
BROWSER_POOL_SIZE=10
PAGE_TIMEOUT=30000
NAVIGATION_TIMEOUT=60000

# Security
CORS_ORIGIN=http://localhost:5173
```

#### Frontend Configuration
```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom']
        }
      }
    }
  }
});
```

## 📡 API Documentation

### Request/Response Formats

All API endpoints accept and return JSON data with proper HTTP status codes:

- `200` - Success
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

### Error Handling

```json
{
  "error": "Validation failed",
  "message": "URL is required and must be valid",
  "timestamp": 1694188800000,
  "path": "/api/scan"
}
```

### Rate Limiting

- **Window**: 15 minutes
- **Limit**: 100 requests per IP
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## 🚀 Deployment

### Production Deployment

#### Using Docker
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build individual containers
docker build -t accessibility-frontend ./access
docker build -t accessibility-backend ./server
```

#### Manual Deployment
```bash
# Backend deployment
cd server
npm install --production
npm start

# Frontend deployment
cd access
npm install
npm run build
# Serve dist/ directory with nginx or Apache
```

#### Environment Setup
```bash
# Production environment variables
NODE_ENV=production
PORT=4000
GEMINI_API_KEY=your_production_key
CORS_ORIGIN=https://yourdomain.com
```

### Deployment Platforms

#### Render.com (Recommended)
```yaml
# render.yaml
services:
  - type: web
    name: accessibility-backend
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

#### Vercel/Netlify (Frontend)
```json
{
  "build": {
    "command": "npm run build",
    "output": "dist"
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://your-backend.render.com/api/$1" }
  ]
}
```

## 🛠️ Development

### Local Development Setup

1. **Install dependencies**
```bash
# Backend
cd server && npm install

# Frontend  
cd access && npm install
```

2. **Environment configuration**
```bash
# Copy environment templates
cp server/.env.example server/.env
# Configure your API keys and settings
```

3. **Start development servers**
```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd access && npm run dev
```

### Development Scripts

#### Backend Scripts
```json
{
  "start": "node index.js",
  "dev": "nodemon index.js",
  "test": "jest",
  "lint": "eslint .",
  "format": "prettier --write ."
}
```

#### Frontend Scripts
```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "lint": "eslint . --ext js,jsx",
  "format": "prettier --write src/"
}
```

### Code Quality

#### ESLint Configuration
```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended'
  ],
  rules: {
    'no-unused-vars': 'error',
    'prefer-const': 'error'
  }
};
```

#### Prettier Configuration
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

## 🔍 Testing

### Backend Testing
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

### Frontend Testing
```bash
# Component tests
npm run test

# E2E tests
npm run test:e2e

# Visual regression tests
npm run test:visual
```

### Testing Strategy

#### Unit Tests
- Utility functions
- API endpoint logic
- Component rendering
- State management

#### Integration Tests
- API endpoint workflows
- Browser automation
- Database interactions
- External service integration

#### End-to-End Tests
- Complete user workflows
- Cross-browser compatibility
- Performance benchmarks
- Accessibility compliance

## 🐛 Troubleshooting

### Common Issues

#### "Port already in use"
```bash
# Find and kill process using port 4000
netstat -ano | findstr :4000
taskkill /PID <process_id> /F

# Or use different port
PORT=4001 npm start
```

#### "Browser launch failed"
```bash
# Install Playwright browsers
npx playwright install chromium

# Check system requirements
npx playwright install-deps
```

#### "Rate limit exceeded"
```bash
# Wait for rate limit window to reset (15 minutes)
# Or increase limits in environment variables
RATE_LIMIT_MAX_REQUESTS=200
```

#### "Gemini API errors"
```bash
# Verify API key is valid
echo $GEMINI_API_KEY

# Check API quota and billing
# Ensure proper key permissions
```

### Performance Optimization

#### Memory Management
```javascript
// Monitor memory usage
process.memoryUsage();

// Implement garbage collection hints
if (global.gc) {
  global.gc();
}
```

#### Browser Pool Tuning
```javascript
// Adjust pool size based on available memory
const BROWSER_POOL_SIZE = process.env.NODE_ENV === 'production' ? 5 : 10;
```

### Debug Mode

#### Backend Debugging
```bash
# Enable debug logging
DEBUG=accessibility:* npm start

# Verbose Playwright logs
DEBUG=pw:api npm start
```

#### Frontend Debugging
```javascript
// Enable development mode logging
if (import.meta.env.DEV) {
  console.log('Debug info:', data);
}
```

## 📊 Monitoring & Analytics

### Health Monitoring
```javascript
// Server health metrics
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});
```

### Performance Metrics
- Response times
- Success/failure rates
- Resource utilization
- Browser pool efficiency

### Error Tracking
- Centralized error logging
- Performance monitoring
- User interaction tracking
- Accessibility compliance metrics

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create feature branch**
```bash
git checkout -b feature/amazing-feature
```

3. **Make changes with tests**
4. **Run quality checks**
```bash
npm run lint
npm run test
npm run build
```

5. **Submit pull request**

### Code Standards

- **JavaScript**: ES6+ with async/await
- **React**: Functional components with hooks
- **CSS**: Tailwind utility classes
- **Testing**: Jest for backend, React Testing Library for frontend
- **Documentation**: JSDoc comments for functions
- **Accessibility**: WCAG 2.1 AA compliance

### Commit Guidelines
```
feat: add new accessibility audit feature
fix: resolve browser memory leak issue
docs: update API documentation
test: add integration tests for scan endpoint
refactor: optimize browser pool management
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **axe-core** - Accessibility testing engine
- **Playwright** - Browser automation framework
- **Google Lighthouse** - Performance and SEO auditing
- **React Team** - Frontend framework
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool and development server

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Rahul-Aitla/accessibilty/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Rahul-Aitla/accessibilty/discussions)
- **Email**: support@accessibilityaudit.com
- **Documentation**: [Wiki](https://github.com/Rahul-Aitla/accessibilty/wiki)

---

## 🚀 Quick Reference

### Essential Commands
```bash
# Start development environment
npm run dev:all

# Run all tests
npm run test:all

# Build for production
npm run build:all

# Deploy to production
npm run deploy
```

### API Quick Test
```bash
# Health check
curl http://localhost:4000/health

# Quick accessibility scan
curl -X POST http://localhost:4000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","audits":["accessibility"]}'
```

**Built with ❤️ for web accessibility**
