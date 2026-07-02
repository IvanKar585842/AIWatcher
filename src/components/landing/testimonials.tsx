"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Product Manager",
    company: "TechScale",
    content:
      "WatchFlow AI saved us hours of manual competitor monitoring. The AI summaries tell us exactly what changed on pricing pages — not just that something changed.",
    avatar: "SC",
  },
  {
    name: "Marcus Johnson",
    role: "E-commerce Director",
    company: "RetailFlow",
    content:
      "Price detection mode is incredible. We track 50+ competitor product pages and get instant alerts with old vs new prices. Game changer for our pricing strategy.",
    avatar: "MJ",
  },
  {
    name: "Elena Rodriguez",
    role: "HR Lead",
    company: "TalentFirst",
    content:
      "Job listings mode helps us track when competitors are hiring. The AI categorizes changes perfectly — we know immediately when new roles appear.",
    avatar: "ER",
  },
];

export function Testimonials() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Loved by <span className="gradient-text">teams worldwide</span>
          </h2>
          <p className="text-muted-foreground">See what our users are saying</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Card className="h-full">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    &ldquo;{testimonial.content}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-sm font-semibold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {testimonial.role}, {testimonial.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
