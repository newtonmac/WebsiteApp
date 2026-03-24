import Link from 'next/link';

const FOOTER_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/data-sources', label: 'Data Sources' },
  { href: '/safety', label: 'Safety Disclaimer' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/cookies', label: 'Cookie Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/faq', label: 'FAQ' },
  { href: '/accessibility', label: 'Accessibility' },
  { href: '/contact', label: 'Contact' },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 mt-8 py-6 px-4 text-center">
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-3">
        {FOOTER_LINKS.map(({ href, label }) => (
          <Link key={href} href={href}
            className="text-xs text-slate-500 hover:text-slate-700 no-underline">
            {label}
          </Link>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        &copy; {new Date().getFullYear()} PaddlePoint. All rights reserved.
      </p>
    </footer>
  );
}
