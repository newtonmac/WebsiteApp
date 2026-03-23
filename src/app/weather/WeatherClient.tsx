'use client';
import { useEffect, useRef, useState } from 'react';

export function WeatherClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    setLoaded(true);

    async function loadContent() {
      try {
        const resp = await fetch('/_legacy/paddle-weather.html');
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract styles but strip header/footer/body rules to avoid conflicts
        doc.querySelectorAll('style').forEach(style => {
          let css = style.textContent || '';
          css = css.replace(/\.header\s*\{[^}]*\}/g, '');
          css = css.replace(/\.header[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.back-btn[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.subtitle[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.header-left[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.header-right[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.header-logo[^{]*\{[^}]*\}/g, '');
          css = css.replace(/\.footer[^{]*\{[^}]*\}/g, '');
          css = css.replace(/body\s*\{[^}]*\}/g, '');
          css = css.replace(/html\s*\{[^}]*\}/g, '');
          css = css.replace(/\*\s*\{[^}]*box-sizing[^}]*\}/g, '');
          if (css.trim()) {
            const s = document.createElement('style');
            s.setAttribute('data-legacy', 'weather');
            s.textContent = css;
            document.head.appendChild(s);
          }
        });

        // Remove old header, footer, nav, pp-shared
        const body = doc.body;
        body.querySelectorAll('.header, footer, script[src*="pp-shared"]').forEach(el => el.remove());

        // Inject the main content
        if (containerRef.current) {
          const content = body.querySelector('.main-content') || body;
          containerRef.current.innerHTML = content.innerHTML;
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
        console.error('Failed to load weather content:', err);
      }
    }

    loadContent();

    return () => {
      document.querySelectorAll('style[data-legacy="weather"]').forEach(s => s.remove());
    };
  }, [loaded]);

  return (
    <div ref={containerRef} className="weather-container">
      <div className="flex items-center justify-center py-20 text-slate-400">
        Loading weather data...
      </div>
    </div>
  );
}
