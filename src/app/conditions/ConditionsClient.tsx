'use client';
import { useEffect, useRef, useState } from 'react';

export function ConditionsClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (loaded) return;
    setLoaded(true);

    async function loadContent() {
      try {
        const resp = await fetch('/_legacy/paddle-conditions.html');
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract styles and scope them inside .legacy-conditions wrapper
        let allCss = '';
        doc.querySelectorAll('style').forEach(style => {
          let css = style.textContent || '';
          // Remove rules that conflict with Next.js layout
          css = css.replace(/body\s*\{[^}]*\}/g, '');
          css = css.replace(/html\s*\{[^}]*\}/g, '');
          css = css.replace(/\*\s*\{[^}]*box-sizing[^}]*\}/g, '');
          allCss += css + '\n';
        });

        // Scope all CSS rules inside .legacy-conditions to prevent leaking
        const scopedCss = allCss.replace(
          /([^\r\n,{}]+)(,(?=[^}]*{)|\s*\{)/g,
          (match, selector, rest) => {
            const s = selector.trim();
            // Skip @media, @keyframes, @font-face etc
            if (s.startsWith('@') || s === '' || s.startsWith('from') || s.startsWith('to') || /^\d+%$/.test(s)) return match;
            // Skip selectors already scoped
            if (s.includes('.legacy-conditions')) return match;
            return `.legacy-conditions ${s}${rest}`;
          }
        );

        // Inject scoped styles
        const styleEl = document.createElement('style');
        styleEl.setAttribute('data-legacy', 'conditions');
        styleEl.textContent = scopedCss;
        document.head.appendChild(styleEl);
        styleRef.current = styleEl;

        // Remove old header, footer, nav
        const body = doc.body;
        body.querySelectorAll('.header, .site-footer, footer, script[src*="pp-shared"]').forEach(el => el.remove());

        // Inject content
        if (containerRef.current) {
          const contentDiv = document.createElement('div');
          Array.from(body.children).forEach(child => {
            if (child.tagName !== 'SCRIPT') contentDiv.appendChild(child.cloneNode(true));
          });
          containerRef.current.innerHTML = contentDiv.innerHTML;
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
      } catch (err) { console.error('Failed to load conditions:', err); }
    }
    loadContent();

    // Cleanup: remove scoped styles on unmount (page navigation)
    return () => {
      if (styleRef.current) { styleRef.current.remove(); styleRef.current = null; }
      document.querySelectorAll('style[data-legacy="conditions"]').forEach(s => s.remove());
    };
  }, [loaded]);

  return (
    <div ref={containerRef} className="legacy-conditions">
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'80px 0',color:'#94a3b8'}}>
        Loading water conditions...
      </div>
    </div>
  );
}
