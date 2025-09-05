import './App.css';
import './index.css';
import AccessibilityForm from './components/AccessibilityForm';
import ResultsDashboard from './components/ResultsDashboard';
import React, { useState } from 'react';
import { Toaster } from 'sonner';


function App() {
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const handleScan = async (url, audits = ['accessibility']) => {
    setLoading(true);
    setScanResult(null);
    try {
      const res = await fetch('http://localhost:4000/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, audits })
      });
      const data = await res.json();
      setScanResult({ url, ...data });
    } catch (e) {
      setScanResult({ error: e.message });
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center p-4">
      <h1 className="text-4xl font-extrabold mb-6 tracking-tight text-primary drop-shadow">Accessibility Analyzer</h1>
      <AccessibilityForm onScan={handleScan} loading={loading} />
      {scanResult && <ResultsDashboard result={scanResult} />}
      <Toaster richColors position="top-center" />
    </main>
  );
}

export default App;
