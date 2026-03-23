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

        // Parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract styles
        const styles = doc.querySelectorAll('style');
        styles.forEach(style => {
          const s = document.createElement('style');
          s.textContent = style.textContent;
          document.head.appendChild(s);
        });

        // Extract main content (remove old header and footer)
        const body = doc.body;
        const oldHeader = body.querySelector('.header');
        if (oldHeader) oldHeader.remove();
        const oldFooter = body.querySelector('footer');
        if (oldFooter) oldFooter.remove();

        // Remove old pp-shared.js script tags (layout handles this)
        body.querySelectorAll('script[src*="pp-shared"]').forEach(s => s.remove());

        // Inject the content HTML (without scripts)
        if (containerRef.current) {
          // Get all non-script content
          const content = body.querySelector('.main-content') || body;
          containerRef.current.innerHTML = content.innerHTML;
        }

        // Extract and execute inline scripts in order
        const scripts = body.querySelectorAll('script:not([src])');
        scripts.forEach(script => {
          if (script.textContent && script.textContent.trim()) {
            const s = document.createElement('script');
            s.textContent = script.textContent;
            document.body.appendChild(s);
          }
        });

        // Load Google Maps (external script with callback)
        const mapsScripts = doc.querySelectorAll('script[src*="maps.googleapis"]');
        mapsScripts.forEach(script => {
          const src = script.getAttribute('src');
          if (src && !document.querySelector(`script[src*="maps.googleapis"]`)) {
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.defer = true;
            document.head.appendChild(s);
          }
        });

      } catch (err) {
        console.error('Failed to load weather content:', err);
      }
    }

    loadContent();
  }, [loaded]);

  return (
    <div ref={containerRef} className="weather-container">
      <div className="flex items-center justify-center py-20 text-slate-400">
        Loading weather data...
      </div>
    </div>
  );
}
