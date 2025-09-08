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
    
    try {
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
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          }
        `;
        iframeDoc.head.appendChild(style);
      }

      // Make iframe body relative for absolute overlays
      if (iframeDoc.body) {
        iframeDoc.body.style.position = 'relative';
      }

      // Add new highlights
      if (!issues?.length) return;
      
      issues.forEach(issue => {
        const color = severityColors[issue.impact] || '#dc2626';
        if (!issue.nodes?.length) return;
        
        issue.nodes.forEach(node => {
          if (!node.target?.length) return;
          
          node.target.forEach(selector => {
            try {
              const elements = iframeDoc.querySelectorAll(selector);
              elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                // Only highlight visible elements
                if (rect.width < 2 || rect.height < 2) return;
                
                // Account for scroll position
                const scrollX = iframeDoc.defaultView?.scrollX || 0;
                const scrollY = iframeDoc.defaultView?.scrollY || 0;
                
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
                overlay.setAttribute('data-a11y-issue', issue.id || 'unknown');
                overlay.setAttribute('tabindex', 0);
                overlay.setAttribute('aria-label', `Accessibility issue: ${issue.help || 'Unknown issue'}`);
                
                // Tooltip on hover with improved positioning
                overlay.onmouseenter = (e) => {
                  let tooltip = iframeDoc.getElementById('a11y-tooltip');
                  if (!tooltip) {
                    tooltip = iframeDoc.createElement('div');
                    tooltip.id = 'a11y-tooltip';
                    tooltip.className = 'a11y-tooltip';
                    iframeDoc.body.appendChild(tooltip);
                  }
                  
                  const tooltipText = `${issue.help || 'Unknown issue'} (Impact: ${issue.impact || 'unknown'})\n${issue.description || 'No description'}`;
                  tooltip.textContent = tooltipText;
                  tooltip.style.display = 'block';
                  
                  // Better tooltip positioning
                  const tooltipLeft = Math.max(8, rect.left + scrollX + 8);
                  const tooltipTop = rect.top + scrollY + rect.height + 4;
                  
                  tooltip.style.left = tooltipLeft + 'px';
                  tooltip.style.top = tooltipTop + 'px';
                };
                
                overlay.onmouseleave = () => {
                  const tooltip = iframeDoc.getElementById('a11y-tooltip');
                  if (tooltip) tooltip.style.display = 'none';
                };
                
                // Keyboard support
                overlay.onkeydown = (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    overlay.onmouseenter(e);
                  }
                };
                
                iframeDoc.body.appendChild(overlay);
              });
            } catch (error) {
              console.warn('Failed to highlight element with selector:', selector, error);
            }
          });
        });
      });
    } catch (error) {
      console.error('Failed to highlight accessibility issues:', error);
    }
  };

  React.useEffect(() => {
    highlightIssues();
    
    // Clean up overlays and tooltips on unmount
    return () => {
      try {
        if (!iframeRef.current) return;
        const iframeDoc = iframeRef.current.contentDocument;
        if (!iframeDoc) return;
        
        iframeDoc.querySelectorAll('.a11y-highlight-overlay').forEach(el => el.remove());
        const tooltip = iframeDoc.getElementById('a11y-tooltip');
        if (tooltip) tooltip.remove();
      } catch (error) {
        console.warn('Failed to cleanup accessibility highlights:', error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, iframeRef]);

  return null;
}
