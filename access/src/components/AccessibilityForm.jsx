

import React, { useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
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
    <motion.form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto bg-card rounded-2xl shadow-xl border border-border p-8 flex flex-col gap-6 mb-8"
      aria-labelledby="form-heading"
      role="search"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h2 id="form-heading" className="text-3xl font-extrabold text-center mb-2 text-primary drop-shadow">Website Analysis</h2>
        <p className="text-center text-muted-foreground mb-4 text-base">Enter the URL of the website you want to analyze for accessibility issues.</p>
      </motion.div>
      
      <div className="flex flex-col gap-2 w-full">
        <motion.div 
          className="flex flex-row items-center gap-2 w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <label htmlFor="website-url" className="sr-only">Website URL</label>
          <span className="inline-flex items-center px-3 py-2 bg-muted border border-input rounded-l-lg text-muted-foreground text-lg" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 21a4 4 0 01-5.656 0l-5.657-5.657a4 4 0 010-5.656l8.485-8.485a4 4 0 015.657 0l5.656 5.657a4 4 0 010 5.656l-1.414 1.414" /></svg>
          </span>
          <input
            id="website-url"
            type="url"
            className="flex-1 px-5 py-3 rounded-r-lg border-t border-b border-r border-input focus:outline-none focus:ring-2 focus:ring-ring bg-card text-card-foreground text-lg shadow-sm transition-all duration-200"
            placeholder="https://example.com"
            value={url}
            onChange={e => setUrl(e.target.value)}
            aria-describedby="url-error"
            required
            autoFocus
          />
          <motion.button
            type="submit"
            className="ml-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground font-bold text-lg shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex items-center gap-2 min-w-[120px] justify-center disabled:opacity-60 hover:bg-primary/90 active:bg-primary/80"
            disabled={loading}
            aria-busy={loading}
            aria-label="Analyze website"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
            ) : (
              <span>Analyze</span>
            )}
          </motion.button>
        </motion.div>
        {error && <span id="url-error" className="text-destructive text-sm mt-1 ml-2" role="alert">{error}</span>}
      </div>
      
      <motion.div 
        className="w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <AuditOptions selected={selectedAudits} setSelected={setSelectedAudits} brandColors={brandColors} setBrandColors={setBrandColors} />
      </motion.div>
    </motion.form>
  );
}
