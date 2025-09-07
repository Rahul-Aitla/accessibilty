

import React, { useState } from 'react';
import { toast } from 'sonner';
import AuditOptions from './AuditOptions';


export default function AccessibilityForm({ onScan, loading }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [selectedAudits, setSelectedAudits] = useState(['accessibility']);
  const [brandColors, setBrandColors] = useState('');

  const validateUrl = (value) => {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateUrl(url)) {
      setError('Please enter a valid URL (http/https)');
      toast.error('Please enter a valid URL (http/https)');
      return;
    }
    setError('');
    toast.loading('Auditing website...');
    const brandColorsArr = selectedAudits.includes('brand-color-contrast')
      ? brandColors.split(',').map(c => c.trim()).filter(Boolean)
      : [];
    onScan(url, selectedAudits, brandColorsArr);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8 flex flex-col gap-6 mb-8 animate-fade-in"
      aria-label="Website URL Form"
      role="search"
    >
      <h2 className="text-3xl font-extrabold text-center mb-2 text-primary drop-shadow">Website Analysis</h2>
      <p className="text-center text-gray-500 dark:text-gray-300 mb-4 text-base">Enter the URL of the website you want to analyze for accessibility issues.</p>
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-row items-center gap-2 w-full">
          <span className="inline-flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-l-lg text-gray-500 text-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 21a4 4 0 01-5.656 0l-5.657-5.657a4 4 0 010-5.656l8.485-8.485a4 4 0 015.657 0l5.656 5.657a4 4 0 010 5.656l-1.414 1.414" /></svg>
          </span>
          <input
            id="website-url"
            type="url"
            className="flex-1 px-5 py-3 rounded-r-lg border-t border-b border-r border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-900 text-black dark:text-white text-lg shadow-sm"
            placeholder="https://example.com"
            value={url}
            onChange={e => setUrl(e.target.value)}
            aria-label="Website URL"
            required
            autoFocus
          />
          <button
            type="submit"
            className="ml-2 px-8 py-3 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-lg shadow transition focus:outline-none focus:ring-2 focus:ring-yellow-400 flex items-center gap-2 min-w-[120px] justify-center disabled:opacity-60"
            disabled={loading}
            aria-busy={loading}
            aria-label="Analyze website"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 mr-2 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
            ) : (
              <span>Analyze</span>
            )}
          </button>
        </div>
        {error && <span className="text-red-600 text-sm mt-1 ml-2">{error}</span>}
      </div>
      <div className="w-full">
        <AuditOptions selected={selectedAudits} setSelected={setSelectedAudits} brandColors={brandColors} setBrandColors={setBrandColors} />
      </div>
    </form>
  );
}
