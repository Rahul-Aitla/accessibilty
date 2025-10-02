import './App.css';
import './index.css';
import AccessibilityForm from './components/AccessibilityForm';
import ResultsDashboard from './components/ResultsDashboard';
import ThemeToggle from './components/ThemeToggle';
import ChatBot from './components/ChatBot';
import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'sonner';


function App() {
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSharedReport, setLoadingSharedReport] = useState(false);
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('scanHistory');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('Failed to load scan history from localStorage:', error);
      return [];
    }
  });

  // Get API URL from environment variables
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  
  // Only log in development
  if (import.meta.env.DEV) {
    console.log('API_URL being used:', API_URL);
  }

  // Memoized function to save history to localStorage
  const saveHistoryToStorage = useCallback((newHistory) => {
    try {
      localStorage.setItem('scanHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.warn('Failed to save scan history to localStorage:', error);
      toast.warning('Unable to save scan history');
    }
  }, []);

  // Load scan result from shareable link if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const report = params.get('report');
    if (!report) return;

    setLoadingSharedReport(true);
    
    // If report param looks like a short id (not base64), fetch from backend
    if (/^[A-Za-z0-9_-]{8,}$/.test(report)) {
      fetch(`${API_URL}/api/report/${report}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (data && !data.error) {
            setScanResult(data);
            toast.success('Shared report loaded successfully');
          } else {
            setScanResult({ error: 'Shared report not found.' });
            toast.error('Shared report not found');
          }
        })
        .catch(error => {
          console.error('Failed to load shared report:', error);
          setScanResult({ error: 'Failed to load shared report.' });
          toast.error('Failed to load shared report');
        })
        .finally(() => setLoadingSharedReport(false));
    } else {
      try {
        // Robust base64url decode
        let b64 = report.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const json = atob(b64);
        const decoded = JSON.parse(json);
        setScanResult(decoded);
        toast.success('Shared report loaded successfully');
      } catch (error) {
        console.error('Failed to decode shared report:', error);
        setScanResult({ error: 'Failed to load shared report.' });
        toast.error('Failed to load shared report. The link may be corrupted.');
      } finally {
        setLoadingSharedReport(false);
      }
    }
  }, [API_URL]);

  useEffect(() => {
    saveHistoryToStorage(history);
  }, [history, saveHistoryToStorage]);

  const handleScan = async (url, audits = ['accessibility'], brandColors = []) => {
    if (!url?.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }
    
    // Update scan count for gamification
    const currentCount = parseInt(localStorage.getItem('scanCount') || '0');
    localStorage.setItem('scanCount', (currentCount + 1).toString());

    setLoading(true);
    setScanResult(null);
    
    try {
      const body = { url: url.trim(), audits };
      if (brandColors && brandColors.length > 0) body.brandColors = brandColors;
      
      if (import.meta.env.DEV) {
        console.log('Making API call to:', `${API_URL}/api/scan`);
        console.log('Request body:', body);
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const res = await fetch(`${API_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
      }
      
      // Check if response is actually JSON
      const contentType = res.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await res.text();
        console.error('Expected JSON but got:', responseText.substring(0, 200));
        throw new Error(`Server returned ${contentType || 'unknown content type'} instead of JSON`);
      }
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const resultObj = { url: url.trim(), ...data, date: new Date().toISOString() };
      setScanResult(resultObj);
      setHistory(prev => {
        const newHistory = [resultObj, ...prev.filter(item => item.url !== url.trim())].slice(0, 10);
        return newHistory;
      });
      toast.success('Scan completed successfully');
      
    } catch (error) {
      console.error('Scan error:', error);
      
      let errorMessage = 'Failed to scan website';
      if (error.name === 'AbortError') {
        errorMessage = 'Scan timed out. Please try again.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setScanResult({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col md:flex-row items-start p-4">
      <ThemeToggle />
      <aside className="w-full md:w-64 md:mr-8 mb-6 md:mb-0">
        <h2 className="text-lg font-bold mb-2">Scan History</h2>
        <ul className="space-y-2" role="list">
          {history.length === 0 && !loadingSharedReport && (
            <li className="text-gray-500 text-sm">No scans yet.</li>
          )}
          {loadingSharedReport && (
            <li className="text-gray-500 text-sm">Loading shared report...</li>
          )}
          {history.map((item, idx) => (
            <li 
              key={`${item.url}-${item.date}-${idx}`}
              className="border rounded p-2 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => setScanResult(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setScanResult(item);
                }
              }}
              aria-label={`Load scan result for ${item.url}`}
            >
              <div className="truncate text-sm font-medium">{item.url}</div>
              <div className="text-xs text-gray-500">
                {item.date ? new Date(item.date).toLocaleString() : 'Unknown date'}
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex-1 flex flex-col items-center w-full">
        <h1 className="text-4xl font-extrabold mb-6 tracking-tight text-primary drop-shadow">
          Accessibility Analyzer
        </h1>
        <AccessibilityForm onScan={handleScan} loading={loading} />
        {scanResult && <ResultsDashboard result={scanResult} />}
      </section>
      <ChatBot 
        scanResult={scanResult} 
        websiteUrl={scanResult?.url} 
        apiUrl={API_URL} 
      />
      <Toaster richColors position="top-center" />
    </main>
  );
}

export default App;
