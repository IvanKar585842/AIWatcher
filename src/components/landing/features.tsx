"use client";

import { motion } from "framer-motion";
import {
  Brain,
  Target,
  Table,
  Briefcase,
  DollarSign,
  Search,
  Globe,
  Sparkles,
  Code,
  Hash,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Brain,
    title: "AI Smart Summaries",
    description:
      "Our AI doesn't just detect changes — it explains what changed, classifies the type, and rates importance.",
  },
  {
    icon: Globe,
    title: "Entire Page Monitoring",
    description: "Track complete page changes with intelligent noise filtering for ads, timestamps, and tracking.",
  },
  {
    icon: Code,
    title: "CSS Selector & XPath",
    description: "Pinpoint specific elements on any page for surgical precision monitoring.",
  },
  {
    icon: DollarSign,
    title: "Price Detection",
    description: "Automatically detect and track price changes on e-commerce and SaaS pricing pages.",
  },
  {
    icon: Hash,
    title: "Keyword Detection",
    description: "Monitor for specific keywords and get alerted when they appear or disappear.",
  },
  {
    icon: Table,
    title: "Table Detection",
    description: "Track changes in data tables — perfect for financial data, leaderboards, and reports.",
  },
  {
    icon: Briefcase,
    title: "Job Listings",
    description: "Monitor career pages and job boards. Know instantly when new positions are posted.",
  },
  {
    icon: Sparkles,
    title: "AI Smart Mode",
    description: "Let AI automatically determine what's important on any page — zero configuration needed.",
  },
  {
    icon: Target,
    title: "Meaningful Diff",
    description: "Compare cleaned content that strips ads, cookies, random IDs, and dynamic timestamps.",
  },
  {
    icon: Search,
    title: "Searchable History",
    description: "Full timeline of every change with diff viewer and powerful search across all monitors.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            8 Monitoring Modes. <span className="gradient-text">One Platform.</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From simple page monitoring to AI-powered smart detection — WatchFlow adapts to your needs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10 mb-2">
                    <feature.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
