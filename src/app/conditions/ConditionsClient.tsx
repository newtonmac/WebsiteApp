'use client';
import { useEffect, useRef, useState } from 'react';

export function ConditionsClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    setLoaded(true);

    async function loadContent() {
      try {
        const resp = await fetch('/_legacy/paddle-conditions.html');
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract and inject styles
        doc.querySelectorAll('style').forEach(style => {
          const s = document.createElement('style');
          s.textContent = style.textContent;
          document.head.appendChild(s);
        });

        // Remove old header, footer, pp-shared script
        const body = doc.body;
        const oldHeader = body.querySelector('.header');
        if (oldHeader) oldHeader.remove();
        const oldFooter = body.querySelector('.site-footer');
        if (oldFooter) oldFooter.remove();
        body.querySelectorAll('script[src*="pp-shared"]').forEach(s => s.remove());

        // Inject content
        if (containerRef.current) {
          // Clone everything except script tags
          const contentDiv = document.createElement('div');
          Array.from(body.children).forEach(child => {
            if (child.tagName !== 'SCRIPT') {
              contentDiv.appendChild(child.cloneNode(true));
            }
          });
          containerRef.current.innerHTML = contentDiv.innerHTML;
        }

        // Execute inline scripts in order
        body.querySelectorAll('script:not([src])').forEach(script => {
          if (script.textContent?.trim()) {
            const s = document.createElement('script');
            s.textContent = script.textContent;
            document.body.appendChild(s);
          }
        });

        // Load Google Maps
        const mapsScript = doc.querySelector('script[src*="maps.googleapis"]');
        if (mapsScript && !document.querySelector('script[src*="maps.googleapis"]')) {
          const s = document.createElement('script');
          s.src = mapsScript.getAttribute('src') || '';
          s.async = true;
          s.defer = true;
          document.head.appendChild(s);
        }
      } catch (err) {
        console.error('Failed to load conditions content:', err);
      }
    }

    loadContent();
  }, [loaded]);

  return (
    <div ref={containerRef} className="conditions-container">
      <div className="flex items-center justify-center py-20 text-slate-400">
        Loading water conditions...
      </div>
    </div>
  );
}
