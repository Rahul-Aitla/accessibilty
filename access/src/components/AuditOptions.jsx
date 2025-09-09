import React, { useState } from 'react';
import { toast } from 'sonner';

const auditOptions = [
  { label: 'Accessibility', value: 'accessibility', checked: true },
  { label: 'Performance', value: 'performance', checked: false },
  { label: 'Best Practices', value: 'best-practices', checked: false },
  { label: 'SEO', value: 'seo', checked: false },
  { label: 'PWA', value: 'pwa', checked: false },
  { label: 'Brand Color Contrast', value: 'brand-color-contrast', checked: false },
];

export default function AuditOptions({ selected, setSelected, brandColors, setBrandColors }) {
  const handleChange = (value) => {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };
  return (
    <fieldset className="flex flex-col gap-2 w-full">
      <legend className="font-semibold text-base mb-2" id="audit-options-legend">Audit Options</legend>
      <div className="flex flex-wrap gap-3" role="group" aria-labelledby="audit-options-legend">
        {auditOptions.map(opt => (
          <label
            key={opt.value}
            className={`flex items-center gap-2 cursor-pointer select-none px-4 py-2 rounded-full border border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-base font-medium shadow-sm transition focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${selected.includes(opt.value) ? 'ring-2 ring-blue-600 bg-blue-50 dark:bg-blue-900/30 border-blue-600' : ''}`}
          >
            <input
              type="checkbox"
              id={`audit-option-${opt.value}`}
              checked={selected.includes(opt.value)}
              onChange={() => handleChange(opt.value)}
              className="accent-blue-600 w-5 h-5 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 rounded"
              aria-checked={selected.includes(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      {selected.includes('brand-color-contrast') && (
        <div className="flex flex-col gap-1 mt-3 max-w-xs">
          <label htmlFor="brand-colors" className="text-xs font-semibold text-gray-700 dark:text-gray-200">Brand Colors (hex, comma separated)</label>
          <input
            id="brand-colors"
            type="text"
            className="px-3 py-2 rounded-lg border border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-black dark:text-white text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            placeholder="#2563eb,#dc2626"
            value={brandColors}
            onChange={e => setBrandColors(e.target.value)}
            aria-describedby="brand-colors-desc"
          />
          <span id="brand-colors-desc" className="text-xs text-muted-foreground mt-1">Enter hex color codes separated by commas (e.g., #2563eb,#dc2626)</span>
        </div>
      )}
    </fieldset>
  );
}
