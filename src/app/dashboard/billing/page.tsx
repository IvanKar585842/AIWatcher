"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { PRICING_PLANS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) {
      // Could show toast
    }
  }, []);

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

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/checkout");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <CommandPageHeader
        label="Subscription"
        title="Billing"
        description="Manage your subscription and billing."
      >
        <Button variant="outline" onClick={openPortal} disabled={portalLoading}>
          {portalLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4 mr-2" />
          )}
          Billing Portal
        </Button>
      </CommandPageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PRICING_PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={cn(plan.popular && "border-blue-500 shadow-lg")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                {plan.popular && <Badge>Popular</Badge>}
              </div>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-2">
                <span className="text-3xl font-bold">${plan.price}</span>
                {plan.price > 0 && (
                  <span className="text-muted-foreground">/mo</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            {plan.id !== "free" && (
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handleUpgrade(plan.plan as "PRO" | "BUSINESS")}
                  disabled={loading === plan.plan}
                >
                  {loading === plan.plan && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Upgrade to {plan.name}
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
