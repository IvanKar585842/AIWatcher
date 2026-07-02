import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How does WatchFlow AI differ from other monitoring tools?",
    answer:
      "Unlike traditional change detectors that send generic 'page changed' alerts, WatchFlow AI analyzes the actual content difference and explains what changed and why it matters — classified by category with importance ratings.",
  },
  {
    question: "What monitoring modes are available?",
    answer:
      "We offer 8 modes: Entire Page, CSS Selector, XPath, Price Detection, Keyword Detection, Table Detection, Job Listings, and AI Smart Mode which automatically determines what's important on any page.",
  },
  {
    question: "How does the AI filtering work?",
    answer:
      "Before comparing pages, we strip ads, tracking scripts, dynamic timestamps, cookies, and random IDs. Only meaningful content is compared and sent to AI for analysis.",
  },
  {
    question: "Can I use Telegram for notifications?",
    answer:
      "Yes! Telegram notifications are available on Pro and Business plans. Link your account via the dashboard and use bot commands like /list, /pause, /resume, and /latest.",
  },
  {
    question: "What intervals can I set?",
    answer:
      "Free plan supports 12-hour intervals. Pro and Business plans support intervals from 5 minutes to 24 hours: 5 min, 15 min, 30 min, 1 hour, 6 hours, 12 hours, and 24 hours.",
  },
  {
    question: "Do you respect robots.txt?",
    answer:
      "Yes, by default all monitors respect robots.txt. You can disable this per-monitor if you have permission to monitor the page.",
  },
  {
    question: "Which AI providers are supported?",
    answer:
      "WatchFlow supports OpenAI, Claude (Anthropic), and Google Gemini. Switch providers with a single configuration variable — no code changes needed.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. Cancel your subscription anytime from the billing portal. You'll retain access until the end of your billing period.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
