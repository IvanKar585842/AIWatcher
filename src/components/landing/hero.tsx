"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Zap, Shield, Bell } from "lucide-react";
import { SignUpCTA } from "@/components/auth/clerk-wrappers";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm mb-6">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI-Powered Web Monitoring
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Know <span className="gradient-text">what changed</span>
            <br />
            and <span className="gradient-text">why it matters</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Monitor any webpage and get intelligent AI explanations of changes — not just alerts.
            Track prices, jobs, policies, and more with precision.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <SignUpCTA className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-base px-8">
              Start Monitoring Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </SignUpCTA>
            <Link href="#features">
              <Button size="lg" variant="outline" className="text-base px-8">
                See How It Works
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { icon: Zap, label: "Real-time detection", desc: "5 min intervals on Pro" },
              { icon: Shield, label: "Smart filtering", desc: "Ignores ads & noise" },
              { icon: Bell, label: "Instant alerts", desc: "Email & Telegram" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card/50"
              >
                <item.icon className="h-5 w-5 text-blue-500" />
                <span className="font-medium text-sm">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.desc}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
