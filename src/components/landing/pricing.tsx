"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { SignUpCTA } from "@/components/auth/clerk-wrappers";
import { PRICING_PLANS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Pricing() {
  const isSignedIn = false;
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpgrade(plan: "PRO" | "BUSINESS") {
    setLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <section id="pricing" className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple, <span className="gradient-text">transparent pricing</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Start free, upgrade when you need more power. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PRICING_PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Card
                className={cn(
                  "h-full relative",
                  plan.popular && "border-blue-500 shadow-lg shadow-blue-500/10 scale-105"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground">/month</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {plan.id === "free" ? (
                    <SignUpCTA className="w-full">
                      {plan.cta}
                    </SignUpCTA>
                  ) : isSignedIn ? (
                    <Button
                      className={cn(
                        "w-full",
                        plan.popular && "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
                      )}
                      onClick={() => handleUpgrade(plan.plan as "PRO" | "BUSINESS")}
                      disabled={loading === plan.plan}
                    >
                      {loading === plan.plan ? "Loading..." : plan.cta}
                    </Button>
                  ) : (
                    <SignUpCTA
                      className={cn(
                        "w-full",
                        plan.popular && "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
                      )}
                    >
                      {plan.cta}
                    </SignUpCTA>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
