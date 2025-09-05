import React, { useState } from 'react';
import { toast } from 'sonner';

const auditOptions = [
  { label: 'Accessibility', value: 'accessibility', checked: true },
  { label: 'Performance', value: 'performance', checked: false },
  { label: 'Best Practices', value: 'best-practices', checked: false },
  { label: 'SEO', value: 'seo', checked: false },
  { label: 'PWA', value: 'pwa', checked: false },
];

export default function AuditOptions({ selected, setSelected }) {
  const handleChange = (value) => {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };
  return (
    <fieldset className="flex flex-wrap gap-3 mb-4" aria-label="Audit Options">
      <legend className="font-semibold text-sm mb-1">Audit Types</legend>
      {auditOptions.map(opt => (
        <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none px-3 py-1 rounded border border-gray-300 bg-gray-50 dark:bg-gray-800 text-sm font-medium focus-within:ring-2 focus-within:ring-primary">
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => handleChange(opt.value)}
            className="accent-primary"
          />
          {opt.label}
        </label>
      ))}
    </fieldset>
  );
}
