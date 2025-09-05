
import React, { useState } from 'react';
import { toast } from 'sonner';
import AuditOptions from './AuditOptions';

export default function AccessibilityForm({ onScan, loading }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [selectedAudits, setSelectedAudits] = useState(['accessibility']);

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
    onScan(url, selectedAudits);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-xl flex flex-col gap-4 mb-6"
      aria-label="Website URL Form"
      role="search"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="website-url" className="font-medium text-sm text-gray-700 dark:text-gray-200">
          Website URL
        </label>
        <input
          id="website-url"
          type="url"
          className="px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-900 text-black dark:text-white"
          placeholder="Enter website URL (https://...)"
          value={url}
          onChange={e => setUrl(e.target.value)}
          aria-label="Website URL"
          required
          autoFocus
        />
      </div>
      <AuditOptions selected={selectedAudits} setSelected={setSelectedAudits} />
      <button
        type="submit"
        className="px-6 py-2 rounded bg-primary text-white font-semibold hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary flex items-center gap-2 min-w-[120px] justify-center disabled:opacity-60"
        disabled={loading}
        aria-busy={loading}
        aria-label="Analyze website"
      >
        {loading ? (
          <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
        ) : (
          <span>Analyze</span>
        )}
      </button>
      {error && <span className="text-red-600 ml-2">{error}</span>}
    </form>
  );
}
