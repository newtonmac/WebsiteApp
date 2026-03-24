'use client';

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">{title}</h1>
      <div className="prose prose-slate prose-sm max-w-none
        [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-slate-800 [&_h3]:mt-6 [&_h3]:mb-3
        [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-4
        [&_ul]:text-slate-600 [&_ul]:mb-4 [&_ul]:pl-6 [&_ul]:list-disc
        [&_li]:mb-2 [&_li]:leading-relaxed
        [&_a]:text-cyan-600 [&_a]:underline hover:[&_a]:text-cyan-800
        [&_strong]:text-slate-800
        [&_em]:text-slate-500">
        {children}
      </div>
    </div>
  );
}
