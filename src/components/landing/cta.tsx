"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SignUpCTA } from "@/components/auth/clerk-wrappers";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 p-12 text-center text-white"
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZoLTJWMjRoMnY0ek0zNiAyMGgtMnYtNGgydjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4 relative">
            Start monitoring in under 60 seconds
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-xl mx-auto relative">
            Join thousands of users who never miss an important web change again.
          </p>
          <SignUpCTA className="text-base px-8 relative bg-secondary text-secondary-foreground hover:bg-secondary/80">
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </SignUpCTA>
        </motion.div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold gradient-text">WatchFlow AI</span>
            <span className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/#features" className="hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="/#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/#faq" className="hover:text-foreground transition-colors">
              FAQ
            </Link>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
