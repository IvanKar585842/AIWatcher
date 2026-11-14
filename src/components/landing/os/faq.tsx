const FAQS = [
  {
    q: "Who is WatchFlowing for?",
    a: "Companies that want an assistant on the websites they own. Add your homepage, docs, pricing, or another page you operate. WatchFlowing explains what changed and when a page needs attention.",
  },
  {
    q: "How do we add a site?",
    a: "Add the homepage, docs, pricing page, or another page your company operates. WatchFlowing stores a baseline, then explains the next important change.",
  },
  {
    q: "What if our site blocks automated checks?",
    a: "The outside look stops, and the last good snapshot stays. WatchFlowing does not bypass the bot check. Paste one script into the site you own. After the page loads, it sends the public text with forms, cookies, and email addresses removed. Nobody is identified. Delete the script and the reports stop. A call from your server can send the same page, plus the HTTP status, when nobody is visiting.",
  },
  {
    q: "What can the assistant watch on our site?",
    a: "The whole page, a section, your docs, your pricing page, keywords you care about, and a plain-language description of what matters. Important changes are explained. Noise such as ads and timestamps is filtered first.",
  },
  {
    q: "How often does it look?",
    a: "Free checks run every 12 or 24 hours. Pro can check as often as every 30 minutes. Business can check as often as every minute. The schedule that actually runs is shown in billing.",
  },
];

/**
 * Server Component FAQ — native <details>, zero framer-motion / client JS.
 */
export function OsFaq() {
  return (
    <section id="faq" className="scroll-mt-24 bg-[#090909] py-32">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-12 text-center">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-500/70">
            FAQ
          </p>
          <h2 className="text-3xl font-light text-zinc-100">Common questions</h2>
        </div>

        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <details
              key={faq.q}
              className="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] open:border-white/[0.08]"
              open={i === 0}
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-medium text-zinc-200">{faq.q}</span>
                <span className="font-mono text-xs text-cyan-500/60 group-open:hidden">+</span>
                <span className="hidden font-mono text-xs text-cyan-500/60 group-open:inline">
                  −
                </span>
              </summary>
              <div className="border-t border-white/[0.04] px-5 pb-4 pt-1">
                <p className="text-sm leading-relaxed text-zinc-500">{faq.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
