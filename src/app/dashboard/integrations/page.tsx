"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  ExternalLink,
  Mail,
  MessageCircle,
  Plug,
  Slack,
  Webhook,
  Zap,
} from "lucide-react";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";
import { cn } from "@/lib/utils";

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "active" | "coming_soon";
  href?: string;
};

const INTEGRATIONS: Integration[] = [
  {
    id: "email",
    name: "Email notifications",
    description: "Receive change alerts and digests at your account email via Resend.",
    icon: Mail,
    status: "active",
    href: "/dashboard/settings",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Instant mobile alerts and bot commands for your monitors.",
    icon: MessageCircle,
    status: "coming_soon",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Post important change alerts into your team channels.",
    icon: Slack,
    status: "coming_soon",
  },
  {
    id: "discord",
    name: "Discord",
    description: "Send monitoring updates to Discord webhooks and servers.",
    icon: MessageCircle,
    status: "coming_soon",
  },
  {
    id: "webhooks",
    name: "Webhooks",
    description: "Push structured change events to your own HTTP endpoints.",
    icon: Webhook,
    status: "coming_soon",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect WatchFlowing to thousands of apps without writing code.",
    icon: Zap,
    status: "coming_soon",
  },
];

function IntegrationCard({ item, index }: { item: Integration; index: number }) {
  const Icon = item.icon;
  const active = item.status === "active";

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "group relative h-full rounded-2xl border p-5 transition-colors",
        active
          ? "border-emerald-500/20 bg-emerald-500/[0.04] hover:border-emerald-500/35"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl border",
            active
              ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
              : "border-white/[0.08] bg-black/30 text-zinc-400"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {active ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-300">
            <Check className="h-3 w-3" />
            Active
          </span>
        ) : (
          <span className="rounded-full border border-white/[0.08] bg-black/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
            Coming soon
          </span>
        )}
      </div>

      <h3 className="mt-4 text-sm font-medium text-zinc-100">{item.name}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{item.description}</p>

      {active && item.href && (
        <p className="mt-4 inline-flex items-center gap-1 text-xs text-cyan-400/90 group-hover:text-cyan-300">
          Manage in Settings
          <ExternalLink className="h-3 w-3" />
        </p>
      )}
    </motion.div>
  );

  if (active && item.href) {
    return (
      <Link href={item.href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}

export default function IntegrationsPage() {
  const active = INTEGRATIONS.filter((i) => i.status === "active");
  const comingSoon = INTEGRATIONS.filter((i) => i.status === "coming_soon");

  return (
    <div className="p-4 lg:p-6">
      <CommandPageHeader
        label="Connect"
        title="Integrations"
        description="Connect WatchFlowing to the tools your team already uses."
      />

      <div className="mb-8 flex items-center gap-2 text-xs text-zinc-500">
        <Plug className="h-4 w-4 text-cyan-400" />
        {active.length} active · {comingSoon.length} coming soon
      </div>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Active</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((item, i) => (
            <IntegrationCard key={item.id} item={item} index={i} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Coming soon
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {comingSoon.map((item, i) => (
            <IntegrationCard key={item.id} item={item} index={i + active.length} />
          ))}
        </div>
      </section>
    </div>
  );
}
