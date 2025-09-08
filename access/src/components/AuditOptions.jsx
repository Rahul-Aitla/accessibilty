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
  const [brandColorError, setBrandColorError] = useState('');

  const handleChange = (value) => {
    if (!setSelected) {
      console.warn('setSelected function not provided to AuditOptions');
      return;
    }
    
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const handleBrandColorChange = (e) => {
    const value = e.target.value;
    setBrandColors(value);
    
    // Validate hex colors if input is not empty
    if (value.trim()) {
      const colors = value.split(',').map(c => c.trim());
      const invalidColors = colors.filter(color => 
        !color.match(/^#[0-9A-Fa-f]{6}$/) && !color.match(/^#[0-9A-Fa-f]{3}$/)
      );
      
      if (invalidColors.length > 0) {
        setBrandColorError(`Invalid hex colors: ${invalidColors.join(', ')}`);
      } else {
        setBrandColorError('');
      }
    } else {
      setBrandColorError('');
    }
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
          <label 
            htmlFor="brand-colors-input"
            className="text-xs font-semibold text-gray-700 dark:text-gray-200"
          >
            Brand Colors (hex, comma separated)
          </label>
          <input
            id="brand-colors-input"
            type="text"
            className={`px-3 py-2 rounded-lg border text-base shadow-sm focus:outline-none focus:ring-2 ${
              brandColorError 
                ? 'border-red-400 bg-red-50 dark:bg-red-900/30 focus:ring-red-400' 
                : 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 focus:ring-yellow-400'
            } text-black dark:text-white`}
            placeholder="#2563eb,#dc2626"
            value={brandColors}
            onChange={handleBrandColorChange}
            aria-describedby={brandColorError ? "brand-color-error" : undefined}
          />
          {brandColorError && (
            <span id="brand-color-error" className="text-xs text-red-600 dark:text-red-400">
              {brandColorError}
            </span>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Example: #ff0000,#00ff00,#0000ff
          </span>
        </div>
      )}
    </fieldset>
  );
}
