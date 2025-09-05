
import React from 'react';
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

  if (result.error) return <div className="text-red-600 font-semibold p-4 bg-red-50 rounded">{result.error}</div>;
  const violations = result.accessibility?.violations || [];
  if (!violations.length) return <div className="text-green-700 font-semibold p-4 bg-green-50 rounded">No accessibility issues found! 🎉</div>;
  const groups = groupBySeverity(violations);
  const total = violations.length;

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

  return (
    <section className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 mt-6 border border-gray-200 dark:border-gray-800 animate-fade-in">
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
          <span className="text-lg font-semibold">Compliance</span>
          <span className={total === 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
            {total === 0 ? 'Compliant' : 'Non-compliant'}
          </span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(groups).map(([severity, issues]) => (
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
                    <div className="text-xs mt-1"><span className="font-semibold">WCAG:</span> {issue.tags.filter(t => t.startsWith('wcag')).join(', ')}</div>
                    <div className="text-xs mt-1"><span className="font-semibold">Selector:</span> {issue.nodes[0]?.target?.join(' ')}</div>
                    <div className="text-xs mt-1"><span className="font-semibold">Snippet:</span> <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{issue.nodes[0]?.html?.slice(0, 100)}</code></div>
                    <div className="text-xs mt-1"><span className="font-semibold">Why it matters:</span> {issue.helpUrl ? <a href={issue.helpUrl} className="underline text-blue-600" target="_blank" rel="noopener noreferrer">Learn more</a> : 'See WCAG reference.'}</div>
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
