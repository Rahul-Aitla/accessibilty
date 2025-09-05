
import React, { useState, useRef } from 'react';
import { toast } from 'sonner';

import VisualHighlightOverlay from './VisualHighlightOverlay';

// Returns a promise that resolves to the short link
async function getShareableLink(result) {
  const base = window.location.origin + window.location.pathname;
  try {
    const res = await fetch('http://localhost:4000/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    });
    const data = await res.json();
    if (data.id) {
      return `${base}?report=${data.id}`;
    } else {
      throw new Error('No id returned');
    }
  } catch (e) {
    // fallback to old method (base64, but warn user)
    toast.error('Failed to generate short link, using long link. Large reports may not work.');
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(result)))));
    return `${base}?report=${encoded}`;
  }
}
function downloadCSV(violations, url) {
  if (!violations.length) return;
  const headers = [
    'Issue', 'Description', 'Impact', 'WCAG', 'Selector', 'Snippet', 'Help URL'
  ];
  const rows = violations.map(issue => [
    issue.help,
    issue.description,
    issue.impact,
    issue.tags.filter(t => t.startsWith('wcag')).join('; '),
    issue.nodes[0]?.target?.join(' '),
    (issue.nodes[0]?.html || '').replace(/\n/g, ' ').slice(0, 100),
    issue.helpUrl || ''
  ]);
  const csvContent = [
    [`Scanned URL: ${url}`],
    headers,
    ...rows
  ].map(row => row.map(field => '"' + String(field).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'accessibility-report.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
  const groups = { critical: [], serious: [], moderate: [], minor: [] };
  violations.forEach(v => {
    groups[v.impact]?.push(v);
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

  if (result.error) return <div className="text-red-600 font-semibold p-4 bg-red-50 rounded">{result.error}</div>;
  const violations = result.accessibility?.violations || [];
  if (!violations.length) return <div className="text-green-700 font-semibold p-4 bg-green-50 rounded">No accessibility issues found! 🎉</div>;
  const groups = groupBySeverity(violations);
  // Filtering and searching
  const filteredGroups = Object.fromEntries(
    Object.entries(groups).map(([severity, issues]) => [
      severity,
      issues.filter(issue =>
        (filter === 'all' || issue.impact === filter) &&
        (
          !search ||
          issue.help.toLowerCase().includes(search.toLowerCase()) ||
          issue.description.toLowerCase().includes(search.toLowerCase()) ||
          (issue.nodes[0]?.target?.join(' ') || '').toLowerCase().includes(search.toLowerCase())
        )
      )
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
    <section className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 mt-6 border border-gray-200 dark:border-gray-800 animate-fade-in">
      <div className="flex justify-end mb-4 gap-2">
        <button
          className="px-4 py-2 rounded bg-primary text-white font-semibold hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary transition"
          onClick={() => downloadCSV(violations, result.url)}
        >
          Download CSV
        </button>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition disabled:opacity-60"
          onClick={handleCopyShareLink}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Copy Shareable Link'}
        </button>
      </div>
      {/* Live Preview */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Live Preview</h3>
        <div className="w-full aspect-video rounded border overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative">
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
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <span className="inline-block w-2 h-8 bg-primary rounded-l"></span>
        Summary Report
      </h2>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="flex justify-end mb-4">
        <button
          className="px-4 py-2 rounded bg-primary text-white font-semibold hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary transition"
          onClick={() => downloadCSV(violations, result.url)}
        >
          Download CSV
        </button>
      </div>
        <div className="flex flex-col gap-1">
          <span className="text-lg font-semibold">URL</span>
          <span className="truncate text-sm text-gray-700 dark:text-gray-200" title={result.url}>{result.url}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-lg font-semibold">Total Issues</span>
          <span className="text-3xl font-bold text-primary">{total}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-lg font-semibold">Score</span>
          <span className="text-3xl font-bold">{score}</span>
        </div>
        <div className="flex flex-col gap-1 items-start">
          <span className="text-lg font-semibold">Badge</span>
          <span className={`inline-block px-3 py-1 rounded-full text-white font-semibold text-sm mt-1 ${badgeColor}`}>{badgeText}</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex flex-col items-center">
          <h4 className="font-semibold mb-2">Severity Distribution</h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={severityData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {severityData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.color} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex flex-col items-center">
          <h4 className="font-semibold mb-2">Issue Categories</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ruleData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h3 className="text-xl font-bold mt-8 mb-4">Detailed Issues List</h3>
      {/* Filters/Search */}
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
                    <div className="text-xs mt-1"><span className="font-semibold">Impact:</span> {issue.impact}</div>
                    <div className="text-xs mt-1"><span className="font-semibold">WCAG:</span> {issue.tags.filter(t => t.startsWith('wcag')).map(tag => (
                      <a
                        key={tag}
                        href={`https://www.w3.org/WAI/WCAG21/quickref/?showtechniques=111%2C112#${tag.replace('wcag', 'wcag').replace(/-/g, '')}`}
                        className="underline text-blue-600 ml-1"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {tag}
                      </a>
                    ))}</div>
                    <div className="text-xs mt-1"><span className="font-semibold">Selector:</span> {issue.nodes[0]?.target?.join(' ')}</div>
                    <div className="text-xs mt-1"><span className="font-semibold">Snippet:</span> <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{issue.nodes[0]?.html?.slice(0, 100)}</code></div>
                    <div className="text-xs mt-1"><span className="font-semibold">Why it matters:</span> {issue.helpUrl ? <a href={issue.helpUrl} className="underline text-blue-600" target="_blank" rel="noopener noreferrer">Learn more</a> : 'See WCAG reference.'}</div>
                    {issue.nodes[0]?.any?.length > 0 && (
                      <div className="text-xs mt-1"><span className="font-semibold">Suggested Fix:</span> {issue.nodes[0].any[0].message}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {/* TODO: Add download, share, and history features */}
    </section>
  );
}
