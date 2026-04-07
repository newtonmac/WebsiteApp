import Image from 'next/image';
import Link from 'next/link';
import { query } from '@/lib/db';

export const revalidate = 3600; // ISR: regenerate every hour

interface Counts {
  clubs: number;
  events: number;
  countries: number;
}

async function getCounts(): Promise<Counts> {
  try {
    const [clubs] = (await query('SELECT COUNT(*) as count FROM clubs')) as any[];
    const [events] = (await query('SELECT COUNT(*) as count FROM events')) as any[];
    const [countries] = (await query('SELECT COUNT(DISTINCT country) as count FROM clubs')) as any[];
    return { clubs: clubs.count, events: events.count, countries: countries.count };
  } catch {
    return { clubs: 7795, events: 70, countries: 86 };
  }
}


const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://paddlepoint.org/#website',
      url: 'https://paddlepoint.org',
      name: 'PaddlePoint',
      description: 'Real-time paddle conditions, weather, clubs, events, and gear for SUP, kayak, outrigger, and canoe paddlers.',
      publisher: { '@id': 'https://paddlepoint.org/#organization' },
    },
    {
      '@type': 'Organization',
      '@id': 'https://paddlepoint.org/#organization',
      name: 'PaddlePoint',
      url: 'https://paddlepoint.org',
      logo: 'https://paddlepoint.org/paddle-pin.svg',
      description: 'A free community resource for paddlers worldwide — no ads, no account required.',
    },
  ],
};

const NAV_CARDS = [
  { href: '/conditions', icon: '🌊', title: 'Water Conditions', desc: 'Live wind, waves, tides, water quality & paddle score' },
  { href: '/clubs', icon: '🛶', title: 'Paddle Clubs', desc: '7,700+ clubs across 77 countries on an interactive map' },
  { href: '/events', icon: '🏁', title: 'Events', desc: 'Races, regattas & championships worldwide' },
  { href: '/gear', icon: '🎯', title: 'Gear', desc: 'Equipment, buyer\'s guides & brand directory' },
  { href: '/federations', icon: '🏛', title: 'Federations', desc: '176 national federations & 5 continental associations' },
];

export default async function HomePage() {
  const counts = await getCounts();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Hero */}
      <section className="relative h-[70vh] md:h-[80vh] lg:h-[85vh] min-h-[500px] max-h-[1000px] flex flex-col items-center justify-center overflow-hidden">
        <picture>
          <source media="(max-width: 600px)" srcSet="/paddlepoint-mobile.jpg" />
          <Image
            src="/paddlepoint.jpg"
            alt="Outrigger paddlers on Mission Bay"
            fill
            className="object-cover object-[center_55%]"
            priority
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/60" />
        <div className="relative z-10 text-center text-white px-4">
          <h2 className="text-4xl md:text-5xl font-extrabold drop-shadow-lg mb-4">
            Know Before You Paddle
          </h2>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto mb-2">
            Real-time water conditions, weather, tides, clubs, and events
            for SUP, kayak, outrigger &amp; canoe paddlers.
          </p>
          <p className="text-sm opacity-70 mb-6">
            🛶 A free community resource for paddlers worldwide — no ads, no account required
          </p>
          <Link
            href="/conditions"
            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-xl transition-colors no-underline"
          >
            Check Conditions
          </Link>
          {/* Stats inside hero */}
          <div className="flex justify-center gap-3 md:gap-6 mt-8">
            {[
              { value: counts.clubs.toLocaleString(), label: 'Paddle Clubs', sub: 'Worldwide', color: 'text-sky-400' },
              { value: counts.countries.toString(), label: 'Countries', sub: 'Covered', color: 'text-violet-400' },
              { value: counts.events.toString(), label: 'Paddling', sub: 'Events', color: 'text-amber-400' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-3 md:px-6 md:py-4 text-center">
                <span className={`text-2xl md:text-3xl font-extrabold ${stat.color}`}>{stat.value}</span>
                <div className="text-[10px] md:text-xs text-white/70 mt-1">{stat.label}<br />{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nav Cards */}
      <section className="max-w-5xl mx-auto px-4 py-6 md:py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {NAV_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="block bg-white border border-slate-200 rounded-xl p-4 no-underline transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-xl mb-2">{card.icon}</div>
              <div className="text-sm font-bold text-slate-800 mb-1">{card.title}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{card.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
