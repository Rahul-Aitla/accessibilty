
import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import html2pdf from 'html2pdf.js';

import VisualHighlightOverlay from './VisualHighlightOverlay';

// Returns a promise that resolves to the short link
async function getShareableLink(result, apiUrl) {
  const base = window.location.origin + window.location.pathname;
  try {
    const res = await fetch(`${apiUrl}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    if (data.id) {
      return `${base}?report=${data.id}`;
    } else {
      throw new Error('No id returned from server');
    }
  } catch (e) {
    console.warn('Failed to generate short link:', e);
    // fallback to old method (base64, but warn user)
    toast.warning('Using fallback link generation. Large reports may not work.');
    try {
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(result))));
      return `${base}?report=${encoded}`;
    } catch (encodeError) {
      console.error('Failed to encode result:', encodeError);
      throw new Error('Failed to generate shareable link');
    }
  }
}
function downloadCSV(violations, url) {
  if (!violations?.length) {
    toast.error('No violations to export');
    return;
  }
  
  try {
    const headers = [
      'Issue', 'Description', 'Impact', 'WCAG', 'Selector', 'Snippet', 'Help URL'
    ];
    const rows = violations.map(issue => [
      issue.help || 'Unknown',
      issue.description || 'No description',
      issue.impact || 'Unknown',
      issue.tags?.filter(t => t.startsWith('wcag')).join('; ') || 'Not specified',
      issue.nodes?.[0]?.target?.join(' ') || 'Not available',
      (issue.nodes?.[0]?.html || '').replace(/\n/g, ' ').slice(0, 100) || 'No HTML snippet',
      issue.helpUrl || ''
    ]);
    
    const csvContent = [
      [`Scanned URL: ${url || 'Unknown'}`],
      [`Generated: ${new Date().toISOString()}`],
      [],
      headers,
      ...rows
    ].map(row => 
      row.map(field => 
        '"' + String(field).replace(/"/g, '""') + '"'
      ).join(',')
    ).join('\r\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url_obj = URL.createObjectURL(blob);
    link.href = url_obj;
    link.download = `accessibility-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the object URL to prevent memory leaks
    setTimeout(() => URL.revokeObjectURL(url_obj), 100);
    
    toast.success('CSV report downloaded successfully');
  } catch (error) {
    console.error('Failed to download CSV:', error);
    toast.error('Failed to download CSV report');
  }
}

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const severityColors = {
  critical: 'bg-red-600',
  serious: 'bg-orange-500',
  moderate: 'bg-yellow-400',
  minor: 'bg-blue-400',
};
const severityChartColors = {
  critical: '#dc2626',
  serious: '#ea580c',
  moderate: '#eab308',
  minor: '#3b82f6',
};

function groupBySeverity(violations) {
  if (!violations?.length) return { critical: [], serious: [], moderate: [], minor: [] };
  
  const groups = { critical: [], serious: [], moderate: [], minor: [] };
  violations.forEach(v => {
    const severity = v.impact || 'minor'; // Default to minor if no impact specified
    if (groups[severity]) {
      groups[severity].push(v);
    }
  });
  return groups;
}
export default function ResultsDashboard({ result }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [generating, setGenerating] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [overlayAllowed, setOverlayAllowed] = useState(true);
  const iframeRef = useRef(null);

  if (result.error) return <div className="text-red-600 font-semibold p-4 bg-red-50 rounded-xl shadow">{result.error}</div>;
  const violations = result.accessibility?.violations || [];
  const brandColorIssues = result.brandColorContrast || [];
  if (!violations.length && !brandColorIssues.length) return <div className="text-green-700 font-semibold p-4 bg-green-50 rounded-xl shadow">No accessibility issues found! 🎉</div>;
  const groups = groupBySeverity(violations);
  // Filtering and searching with improved null safety
  const filteredGroups = Object.fromEntries(
    Object.entries(groups).map(([severity, issues]) => [
      severity,
      issues.filter(issue => {
        // Filter by severity
        const matchesSeverity = filter === 'all' || issue.impact === filter;
        
        // Search filter with null safety
        const matchesSearch = !search || [
          issue.help,
          issue.description,
          issue.nodes?.[0]?.target?.join(' ')
        ].some(field => 
          field && field.toLowerCase().includes(search.toLowerCase())
        );
        
        return matchesSeverity && matchesSearch;
      })
    ])
  );
  const total = violations.length;

  // Score calculation (simple: 100 - (issues * 2), min 0)
  const score = Math.max(0, 100 - total * 2);
  let badgeColor = 'bg-green-600';
  let badgeText = 'Excellent';
  if (score < 90 && score >= 70) { badgeColor = 'bg-yellow-400'; badgeText = 'Good'; }
  else if (score < 70 && score >= 50) { badgeColor = 'bg-orange-500'; badgeText = 'Needs Improvement'; }
  else if (score < 50) { badgeColor = 'bg-red-600'; badgeText = 'Poor'; }

  // Chart data
  const severityData = Object.entries(groups).map(([severity, issues]) => ({
    name: severity.charAt(0).toUpperCase() + severity.slice(1),
    value: issues.length,
    color: severityChartColors[severity],
  })).filter(d => d.value > 0);
  const ruleData = Object.values(violations.reduce((acc, v) => {
    acc[v.id] = acc[v.id] || { name: v.id, value: 0 };
    acc[v.id].value++;
    return acc;
  }, {}));

  // Generate shareable link on demand
  const handleCopyShareLink = async () => {
    setGenerating(true);
    const link = await getShareableLink(result);
    setShareLink(link);
    navigator.clipboard.writeText(link);
    toast.success('Shareable link copied!');
    setGenerating(false);
  };
  
  // Export to PDF function
  const downloadPDF = () => {
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="color: #333;">Accessibility Report</h1>
        <p><strong>URL:</strong> ${result.url}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Score:</strong> ${score}/100 (${badgeText})</p>
        
        <h2 style="margin-top: 20px;">Issues Summary</h2>
        <p>Total issues found: ${total}</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #f3f3f3;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Issue</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Description</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Severity</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Suggestion</th>
            </tr>
          </thead>
          <tbody>
            ${violations.map(issue => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${issue.help}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${issue.description}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${issue.impact || 'Unknown'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${issue.nodes[0]?.any?.[0]?.message || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        ${result.improvementSuggestions ? `
          <h2 style="margin-top: 20px;">AI Improvement Suggestions</h2>
          <div style="padding: 10px; background-color: #f9f9f9; border-left: 4px solid #4a90e2;">
            ${result.improvementSuggestions}
          </div>
        ` : ''}
      </div>
    `;
    
    const opt = {
      margin: 10,
      filename: `accessibility-report-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().from(element).set(opt).save();
    toast.success('PDF report downloaded successfully');
  };

  // Check overlay permission after iframe loads
  const handleIframeLoad = () => {
    setIframeLoaded(true);
    try {
      // Try to access contentDocument to check for cross-origin
      const doc = iframeRef.current?.contentDocument;
      if (!doc) throw new Error('No doc');
      setOverlayAllowed(true);
    } catch {
      setOverlayAllowed(false);
    }
  };

  return (
    <section className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-10 mt-8 border border-gray-200 dark:border-gray-800 animate-fade-in">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-extrabold text-primary flex items-center gap-2">
            <span className="inline-block w-2 h-8 bg-yellow-400 rounded-l"></span>
            Analysis Progress
          </h2>
          <span className="text-lg font-bold text-gray-700 dark:text-gray-200">{Math.max(25, Math.min(100, 100 - total * 2))}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-yellow-400 transition-all" style={{ width: `${Math.max(25, Math.min(100, 100 - total * 2))}%` }}></div>
        </div>
      </div>

      {/* Accessibility Issues Table */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 shadow mb-8">
        <h3 className="text-xl font-bold mb-2">Accessibility Issues</h3>
        <p className="mb-4 text-gray-600 dark:text-gray-300">Here's a breakdown of the issues we found on your site.</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-base">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 px-4 font-semibold text-gray-700 dark:text-gray-200">Issue</th>
                <th className="py-2 px-4 font-semibold text-gray-700 dark:text-gray-200">Description</th>
                <th className="py-2 px-4 font-semibold text-gray-700 dark:text-gray-200">Severity</th>
                <th className="py-2 px-4 font-semibold text-gray-700 dark:text-gray-200">Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((issue, idx) => (
                <tr key={idx} className="border-b border-gray-100 dark:border-gray-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition">
                  <td className="py-2 px-4 font-bold text-gray-900 dark:text-white">{issue.help}</td>
                  <td className="py-2 px-4 text-gray-700 dark:text-gray-200">{issue.description}</td>
                  <td className="py-2 px-4">
                    <span className={`inline-block px-3 py-1 rounded-full font-semibold text-xs ${
                      issue.impact === 'critical' ? 'bg-red-100 text-red-700' :
                      issue.impact === 'serious' ? 'bg-orange-100 text-orange-700' :
                      issue.impact === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {issue.impact?.charAt(0).toUpperCase() + issue.impact?.slice(1) || 'Unknown'}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    {issue.nodes[0]?.any?.length > 0 ? (
                      <span className="text-blue-600 underline cursor-pointer" tabIndex={0}>{issue.nodes[0].any[0].message}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Download/Share Buttons */}
      <div className="flex flex-wrap justify-end gap-3 mb-8">
        <button
          className="px-5 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-black font-bold shadow focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
          onClick={() => downloadCSV(violations, result.url)}
        >
          Download CSV
        </button>
        <button
          className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold shadow focus:outline-none focus:ring-2 focus:ring-green-400 transition"
          onClick={downloadPDF}
        >
          Download PDF
        </button>
        <button
          className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow focus:outline-none focus:ring-2 focus:ring-blue-400 transition disabled:opacity-60"
          onClick={handleCopyShareLink}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Copy Shareable Link'}
        </button>
      </div>

      {/* Live Preview */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Live Preview</h3>
        <div className="w-full aspect-video rounded-xl border overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative">
          <iframe
            ref={iframeRef}
            src={result.url}
            title="Website Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            onLoad={handleIframeLoad}
          />
          {/* Visual highlight overlay for accessibility issues */}
          {iframeLoaded && overlayAllowed && (
            <VisualHighlightOverlay issues={violations} iframeRef={iframeRef} />
          )}
          {iframeLoaded && !overlayAllowed && (
            <div className="absolute top-2 left-2 bg-yellow-200 text-yellow-900 px-3 py-1 rounded shadow text-xs z-50">
              Visual highlighting is not available for cross-origin sites.
            </div>
          )}
        </div>
      </div>

      {/* AI Improvement Suggestions */}
      {result.improvementSuggestions && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 shadow mb-8">
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-8 bg-blue-500 rounded-l"></span>
            AI Improvement Suggestions
          </h3>
          <div className="prose dark:prose-invert max-w-none">
            {result.improvementSuggestions.split('\n').map((line, i) => (
              <p key={i} className="mb-2">{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Brand Color Issues */}
      {brandColorIssues.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-6 shadow mb-8">
          <h3 className="text-xl font-bold mb-4 text-yellow-900 dark:text-yellow-100">Brand Color Contrast & Usage Issues</h3>
          <ul className="space-y-3">
            {brandColorIssues.map((issue, idx) => (
              <li key={idx} className="border rounded-lg p-4 bg-yellow-100/60 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100 shadow-sm">
                <div className="font-semibold mb-1">{issue.type === 'contrast' ? 'Contrast Issue' : 'Usage Issue'}</div>
                <div className="text-xs mb-1">{issue.msg}</div>
                {issue.type === 'contrast' && (
                  <>
                    <div className="text-xs">Element: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{issue.element}</code></div>
                    <div className="text-xs">Color: <span style={{color: issue.color}}>{issue.color}</span> on <span style={{background: issue.background, color: '#222', padding: '0 4px', borderRadius: '2px'}}>{issue.background}</span></div>
                    <div className="text-xs">Contrast Ratio: <span className="font-mono">{issue.contrast.toFixed(2)}</span></div>
                  </>
                )}
                {issue.type === 'usage' && (
                  <div className="text-xs">Brand: <span style={{color: issue.brand}}>{issue.brand}</span></div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detailed Issues List (old, hidden for new UI) */}
      {/*
      <h3 className="text-xl font-bold mt-8 mb-4">Detailed Issues List</h3>
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <label className="font-medium text-sm">Filter by Severity:</label>
        <select
          className="px-2 py-1 rounded border border-gray-300 dark:bg-gray-800 dark:text-white"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="critical">Critical</option>
          <option value="serious">Serious</option>
          <option value="moderate">Moderate</option>
          <option value="minor">Minor</option>
        </select>
        <input
          type="text"
          className="px-2 py-1 rounded border border-gray-300 dark:bg-gray-800 dark:text-white"
          placeholder="Search issues..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(filteredGroups).map(([severity, issues]) => (
          <div key={severity} className="mb-4">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-white font-semibold mb-2 capitalize ${severityColors[severity]}`}>{severity} <span className="ml-1">({issues.length})</span></div>
            {issues.length === 0 ? <div className="ml-4 text-gray-500">No issues</div> : (
              <ul className="mt-2 space-y-3">
                {issues.map((issue, idx) => (
                  <li key={idx} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 shadow-sm transition hover:shadow-md focus-within:ring-2 focus-within:ring-primary" tabIndex={0} aria-label={`Issue: ${issue.help}`}> 
                    <div className="font-semibold text-lg mb-1 flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${severityColors[severity]}`}></span>
                      {issue.help}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">{issue.description}</div>
                    <div className="text-xs mt-1"><span className="font-semibold">Impact:</span> {issue.impact || 'Unknown'}</div>
                    <div className="text-xs mt-1"><span className="font-semibold">WCAG:</span> {issue.tags?.filter(t => t.startsWith('wcag')).map(tag => (
                      <a
                        key={tag}
                        href={`https://www.w3.org/WAI/WCAG21/quickref/?showtechniques=111%2C112#${tag.replace('wcag', 'wcag').replace(/-/g, '')}`}
                        className="underline text-blue-600 ml-1"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {tag}
                      </a>
                    )) || 'Not specified'}</div>
                    <div className="text-xs mt-1"><span className="font-semibold">Selector:</span> {issue.nodes?.[0]?.target?.join(' ') || 'Not available'}</div>
                    <div className="text-xs mt-1"><span className="font-semibold">Snippet:</span> <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{issue.nodes?.[0]?.html?.slice(0, 100) || 'No HTML snippet'}</code></div>
                    <div className="text-xs mt-1"><span className="font-semibold">Why it matters:</span> {issue.helpUrl ? <a href={issue.helpUrl} className="underline text-blue-600" target="_blank" rel="noopener noreferrer">Learn more</a> : 'See WCAG reference.'}</div>
                    {issue.nodes?.[0]?.any?.length > 0 && (
                      <div className="text-xs mt-1"><span className="font-semibold">Suggested Fix:</span> {issue.nodes[0].any[0].message}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      */}
    </section>
  );
}
