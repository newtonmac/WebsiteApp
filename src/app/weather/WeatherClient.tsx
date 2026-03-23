'use client';
import { useEffect, useRef, useState } from 'react';

export function WeatherClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (loaded) return;
    setLoaded(true);

    async function loadContent() {
      try {
        const resp = await fetch('/_legacy/paddle-weather.html');
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract and scope styles inside .legacy-weather
        let allCss = '';
        doc.querySelectorAll('style').forEach(style => {
          let css = style.textContent || '';
          css = css.replace(/body\s*\{[^}]*\}/g, '');
          css = css.replace(/html\s*\{[^}]*\}/g, '');
          css = css.replace(/\*\s*\{[^}]*box-sizing[^}]*\}/g, '');
          allCss += css + '\n';
        });

        // Scope all CSS rules inside .legacy-weather
        const scopedCss = allCss.replace(
          /([^\r\n,{}]+)(,(?=[^}]*{)|\s*\{)/g,
          (match, selector, rest) => {
            const s = selector.trim();
            if (s.startsWith('@') || s === '' || s.startsWith('from') || s.startsWith('to') || /^\d+%$/.test(s)) return match;
            if (s.includes('.legacy-weather')) return match;
            return `.legacy-weather ${s}${rest}`;
          }
        );

        const styleEl = document.createElement('style');
        styleEl.setAttribute('data-legacy', 'weather');
        styleEl.textContent = scopedCss;
        document.head.appendChild(styleEl);
        styleRef.current = styleEl;

        // Remove old header, footer
        const body = doc.body;
        body.querySelectorAll('.header, footer, script[src*="pp-shared"]').forEach(el => el.remove());

        // Inject main content
        if (containerRef.current) {
          const content = body.querySelector('.main-content') || body;
          containerRef.current.innerHTML = content.innerHTML;
        }

        // Execute inline scripts
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
          s.async = true; s.defer = true;
          document.head.appendChild(s);
        }
      } catch (err) { console.error('Failed to load weather:', err); }
    }
    loadContent();

    return () => {
      if (styleRef.current) { styleRef.current.remove(); styleRef.current = null; }
      document.querySelectorAll('style[data-legacy="weather"]').forEach(s => s.remove());
    };
  }, [loaded]);

  return (
    <div ref={containerRef} className="legacy-weather">
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'80px 0',color:'#94a3b8'}}>
        Loading weather data...
      </div>
    </div>
  );
}
