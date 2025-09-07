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
    <fieldset className="flex flex-col gap-2 w-full" aria-label="Audit Options">
      <legend className="font-semibold text-base mb-2">Audit Options</legend>
      <div className="flex flex-wrap gap-3">
        {auditOptions.map(opt => (
          <label
            key={opt.value}
            className={`flex items-center gap-2 cursor-pointer select-none px-4 py-2 rounded-full border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-base font-medium shadow-sm transition focus-within:ring-2 focus-within:ring-primary ${selected.includes(opt.value) ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-400' : ''}`}
            tabIndex={0}
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => handleChange(opt.value)}
              className="accent-yellow-400 w-5 h-5"
              tabIndex={-1}
            />
            {opt.label}
          </label>
        ))}
      </div>
      {selected.includes('brand-color-contrast') && (
        <div className="flex flex-col gap-1 mt-3 max-w-xs">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Brand Colors (hex, comma separated)</label>
          <input
            type="text"
            className="px-3 py-2 rounded-lg border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 text-black dark:text-white text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            placeholder="#2563eb,#dc2626"
            value={brandColors}
            onChange={e => setBrandColors(e.target.value)}
          />
        </div>
      )}
    </fieldset>
  );
}
