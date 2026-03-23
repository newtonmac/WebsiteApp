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

        // Extract styles but scope them to avoid leaking into Next.js header
        doc.querySelectorAll('style').forEach(style => {
          let css = style.textContent || '';
          // Remove header/nav CSS rules that would conflict with Next.js layout
          css = css.replace(/\.header\s*\{[^}]*\}/g, '');
          css = css.replace(/\.header[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.back-btn[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.subtitle[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.header-left[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.header-right[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.header-logo[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.site-footer[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.footer[^{]*\{[^}]*\}/g, '');
          // Remove body reset rules that fight Next.js
          css = css.replace(/body\s*\{[^}]*\}/g, '');
          css = css.replace(/html\s*\{[^}]*\}/g, '');
          css = css.replace(/\*\s*\{[^}]*box-sizing[^}]*\}/g, '');
          if (css.trim()) {
            const s = document.createElement('style');
            s.setAttribute('data-legacy', 'conditions');
            s.textContent = css;
            document.head.appendChild(s);
          }
        });

        // Remove old header, footer, nav, pp-shared
        const body = doc.body;
        body.querySelectorAll('.header, .site-footer, footer, script[src*="pp-shared"]').forEach(el => el.remove());

        // Inject content (everything except scripts)
        if (containerRef.current) {
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

    // Cleanup injected styles on unmount
    return () => {
      document.querySelectorAll('style[data-legacy="conditions"]').forEach(s => s.remove());
    };
  }, [loaded]);

  return (
    <div ref={containerRef} className="conditions-container">
      <div className="flex items-center justify-center py-20 text-slate-400">
        Loading water conditions...
      </div>
    </div>
  );
}
