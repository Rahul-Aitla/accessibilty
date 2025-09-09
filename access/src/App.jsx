import './App.css';
import './index.css';
import AccessibilityForm from './components/AccessibilityForm';


import ResultsDashboard from './components/ResultsDashboard';
import Header from './components/Header';
import Footer from './components/Footer';
import ChatBot from './components/ChatBot';
import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';


function App() {
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('scanHistory') || '[]');
    } catch {
      return [];
    }
  });

  // Get API URL from environment variables
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  
  // Debug: Log the API URL being used
  console.log('API_URL being used:', API_URL);
  console.log('Environment variables:', import.meta.env);

  // Load scan result from shareable link if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const report = params.get('report');
    if (report) {
      // If report param looks like a short id (not base64), fetch from backend
      if (/^[A-Za-z0-9_-]{8,}$/.test(report)) {
        fetch(`${API_URL}/api/report/${report}`)
          .then(res => res.json())
          .then(data => {
            if (data && !data.error) setScanResult(data);
            else setScanResult({ error: 'Shared report not found.' });
          })
          .catch(() => setScanResult({ error: 'Failed to load shared report.' }));
      } else {
        try {
          // Robust base64url decode
          let b64 = report.replace(/-/g, '+').replace(/_/g, '/');
          while (b64.length % 4) b64 += '=';
          const json = atob(b64);
          const decoded = JSON.parse(json);
          setScanResult(decoded);
        } catch (e) {
          setScanResult({ error: 'Failed to load shared report.' });
          if (window.sonner) window.sonner.error('Failed to load shared report. The link may be corrupted.');
        }
      }
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    localStorage.setItem('scanHistory', JSON.stringify(history));
  }, [history]);

  const handleScan = async (url, audits = ['accessibility'], brandColors = []) => {
    setLoading(true);
    setScanResult(null);
    try {
      const body = { url, audits };
      if (brandColors && brandColors.length > 0) body.brandColors = brandColors;
      
      console.log('Making API call to:', `${API_URL}/api/scan`);
      console.log('Request body:', body);
      
      const res = await fetch(`${API_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      console.log('Response status:', res.status);
      console.log('Response headers:', res.headers);
      
      // Check if response is actually JSON
      const contentType = res.headers.get('content-type');
      console.log('Content-Type:', contentType);
      
      if (!contentType || !contentType.includes('application/json')) {
        // Response is not JSON, let's see what it actually is
        const responseText = await res.text();
        console.error('Expected JSON but got:', responseText);
        throw new Error(`Server returned ${contentType || 'unknown content type'} instead of JSON. Response: ${responseText.substring(0, 200)}...`);
      }
      
      const data = await res.json();
      const resultObj = { url, ...data, date: new Date().toISOString() };
      setScanResult(resultObj);
      setHistory(prev => [resultObj, ...prev].slice(0, 10));
    } catch (e) {
      console.error('Scan error:', e);
      setScanResult({ error: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Skip to content link for keyboard users */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring">
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="container mx-auto flex flex-col md:flex-row items-start p-4 pt-8 flex-grow" role="main" aria-label="Main content">
        <aside className="w-full md:w-64 md:mr-8 mb-6 md:mb-0" role="complementary" aria-label="Scan history">
          <div className="sticky top-20">
            <h2 className="text-lg font-bold mb-2" id="history-heading">Scan History</h2>
            <ul className="space-y-2 max-h-[70vh] overflow-y-auto pr-2" aria-labelledby="history-heading">
              <div aria-live="polite">
                {history.length === 0 && <li className="text-muted-foreground text-sm">No scans yet.</li>}
              </div>
              {history.map((item, idx) => (
                <li key={idx}>
                  <button
                    className="w-full text-left border rounded-lg p-3 bg-card text-card-foreground shadow-sm cursor-pointer hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors duration-200" 
                    onClick={() => setScanResult(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setScanResult(item);
                      }
                    }}
                    aria-label={`View scan results for ${item.url} from ${new Date(item.date).toLocaleString()}`}
                  >
                    <div className="truncate text-sm font-medium">{item.url}</div>
                    <div className="text-xs text-muted-foreground">{new Date(item.date).toLocaleString()}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <section className="flex-1 flex flex-col items-center w-full" role="region" aria-label="Accessibility analysis">
          <h1 className="text-4xl font-extrabold mb-6 tracking-tight text-primary drop-shadow">Accessibility Analyzer</h1>
          <AccessibilityForm onScan={handleScan} loading={loading} />
          <div aria-live="polite" aria-atomic="true">
            {scanResult && <ResultsDashboard result={scanResult} />}
          </div>
        </section>
      </main>
      <Footer />
      
      {/* ChatBot component as a side popup */}
      <ChatBot 
        scanResult={scanResult} 
        websiteUrl={scanResult?.url} 
        apiUrl={API_URL} 
        aria-label="Accessibility assistant chatbot"
        role="complementary"
      />
      <Toaster richColors position="top-center" />
    </div>
  );
}

export default App;
