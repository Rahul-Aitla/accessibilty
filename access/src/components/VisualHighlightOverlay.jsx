import React, { useState } from 'react';

/**
 * VisualHighlightOverlay
 * Props:
 *   issues: Array of axe-core violations (nodes with selectors)
 *   iframeRef: React ref to the live preview iframe
 */
export default function VisualHighlightOverlay({ issues, iframeRef }) {
  // Severity color mapping
  const severityColors = {
    critical: '#dc2626',
    serious: '#ea580c',
    moderate: '#eab308',
    minor: '#3b82f6',
  };

  // Inject highlight styles and overlays into the iframe
  const highlightIssues = () => {
    if (!iframeRef.current) return;
    const iframeDoc = iframeRef.current.contentDocument;
    if (!iframeDoc) return;

    // Remove old highlights
    iframeDoc.querySelectorAll('.a11y-highlight-overlay').forEach(el => el.remove());

    // Inject style for overlays (only once)
    if (!iframeDoc.getElementById('a11y-highlight-style')) {
      const style = iframeDoc.createElement('style');
      style.id = 'a11y-highlight-style';
      style.innerHTML = `
        .a11y-highlight-overlay {
          pointer-events: auto;
          box-sizing: border-box;
          border-radius: 4px;
          transition: box-shadow 0.2s;
        }
        .a11y-highlight-overlay:hover {
          box-shadow: 0 0 0 4px rgba(37,99,235,0.2);
        }
        .a11y-tooltip {
          position: absolute;
          background: #222;
          color: #fff;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 4px;
          z-index: 10000;
          pointer-events: none;
          white-space: pre-line;
          max-width: 260px;
        }
      `;
      iframeDoc.head.appendChild(style);
    }

    // Make iframe body relative for absolute overlays
    iframeDoc.body.style.position = 'relative';

    // Add new highlights
    issues.forEach(issue => {
      const color = severityColors[issue.impact] || '#dc2626';
      issue.nodes.forEach(node => {
        node.target.forEach(selector => {
          try {
            const elements = iframeDoc.querySelectorAll(selector);
            elements.forEach(el => {
              const rect = el.getBoundingClientRect();
              // Only highlight visible elements
              if (rect.width < 2 || rect.height < 2) return;
              // Account for scroll position
              const scrollX = iframeDoc.defaultView.scrollX;
              const scrollY = iframeDoc.defaultView.scrollY;
              const overlay = iframeDoc.createElement('div');
              overlay.className = 'a11y-highlight-overlay';
              overlay.style.position = 'absolute';
              overlay.style.left = (rect.left + scrollX) + 'px';
              overlay.style.top = (rect.top + scrollY) + 'px';
              overlay.style.width = rect.width + 'px';
              overlay.style.height = rect.height + 'px';
              overlay.style.border = `2px solid ${color}`;
              overlay.style.background = color + '22';
              overlay.style.zIndex = 9999;
              overlay.setAttribute('data-a11y-issue', issue.id);
              overlay.setAttribute('tabindex', 0);
              // Tooltip on hover
              overlay.onmouseenter = e => {
                let tooltip = iframeDoc.getElementById('a11y-tooltip');
                if (!tooltip) {
                  tooltip = iframeDoc.createElement('div');
                  tooltip.id = 'a11y-tooltip';
                  tooltip.className = 'a11y-tooltip';
                  iframeDoc.body.appendChild(tooltip);
                }
                tooltip.textContent = `${issue.help} (Impact: ${issue.impact})\n${issue.description}`;
                tooltip.style.display = 'block';
                tooltip.style.left = (rect.left + scrollX + 8) + 'px';
                tooltip.style.top = (rect.top + scrollY + rect.height + 4) + 'px';
              };
              overlay.onmouseleave = () => {
                const tooltip = iframeDoc.getElementById('a11y-tooltip');
                if (tooltip) tooltip.style.display = 'none';
              };
              iframeDoc.body.appendChild(overlay);
            });
          } catch {}
        });
      });
    });
  };

  React.useEffect(() => {
    highlightIssues();
    // Clean up overlays and tooltips on unmount
    return () => {
      if (!iframeRef.current) return;
      const iframeDoc = iframeRef.current.contentDocument;
      if (!iframeDoc) return;
      iframeDoc.querySelectorAll('.a11y-highlight-overlay').forEach(el => el.remove());
      const tooltip = iframeDoc.getElementById('a11y-tooltip');
      if (tooltip) tooltip.remove();
    };
    // eslint-disable-next-line
  }, [issues, iframeRef]);

  return null;
}
