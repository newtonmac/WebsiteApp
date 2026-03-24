export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-800 mb-6">{title}</h1>
      <div className="prose prose-slate prose-sm max-w-none
        prose-headings:text-slate-800 prose-headings:font-semibold
        prose-a:text-cyan-600 prose-a:no-underline hover:prose-a:underline
        prose-li:text-slate-600 prose-p:text-slate-600 prose-p:leading-relaxed">
        {children}
      </div>
    </div>
  );
}
