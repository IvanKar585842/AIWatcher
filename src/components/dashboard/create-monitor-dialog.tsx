"use client";

import { useEffect, useState } from "react";
import {
  MonitoringInterval,
  MonitoringMode,
  NotificationMethod,
} from "@prisma/client";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { INTERVAL_LABELS, MODE_LABELS, NOTIFICATION_LABELS } from "@/lib/constants";

interface CreateMonitorDialogProps {
  onCreated: () => void;
  allowedIntervals?: MonitoringInterval[];
}

export function CreateMonitorDialog({ onCreated, allowedIntervals }: CreateMonitorDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    url: "",
    mode: MonitoringMode.ENTIRE_PAGE as MonitoringMode,
    selector: "",
    keywords: "",
    interval: MonitoringInterval.TWELVE_HOURS as MonitoringInterval,
    notificationMethod: NotificationMethod.EMAIL as NotificationMethod,
    respectRobots: true,
  });

  const intervals = allowedIntervals ?? Object.keys(INTERVAL_LABELS) as MonitoringInterval[];

  const needsSelector =
    form.mode === MonitoringMode.CSS_SELECTOR || form.mode === MonitoringMode.XPATH;
  const needsKeywords = form.mode === MonitoringMode.KEYWORD_DETECTION;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          keywords: form.keywords
            ? form.keywords.split(",").map((k) => k.trim()).filter(Boolean)
            : [],
          selector: form.selector || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create monitor");

      setOpen(false);
      setForm({
        name: "",
        url: "",
        mode: MonitoringMode.ENTIRE_PAGE,
        selector: "",
        keywords: "",
        interval: MonitoringInterval.TWELVE_HOURS,
        notificationMethod: NotificationMethod.EMAIL,
        respectRobots: true,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create monitor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
          <Plus className="h-4 w-4 mr-2" />
          New Monitor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Monitor</DialogTitle>
          <DialogDescription>
            Set up a new webpage monitor. We&apos;ll check it at your chosen interval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Friendly Name</Label>
            <Input
              id="name"
              placeholder="e.g. Competitor Pricing Page"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Website URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/page"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Monitoring Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(v) => setForm({ ...form, mode: v as MonitoringMode })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsSelector && (
            <div className="space-y-2">
              <Label htmlFor="selector">
                {form.mode === MonitoringMode.XPATH ? "XPath" : "CSS Selector"}
              </Label>
              <Input
                id="selector"
                placeholder={
                  form.mode === MonitoringMode.XPATH
                    ? "//div[@class='content']"
                    : ".main-content, #pricing"
                }
                value={form.selector}
                onChange={(e) => setForm({ ...form, selector: e.target.value })}
                required
              />
            </div>
          )}

          {needsKeywords && (
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Input
                id="keywords"
                placeholder="sale, discount, limited time"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Interval</Label>
              <Select
                value={form.interval}
                onValueChange={(v) =>
                  setForm({ ...form, interval: v as MonitoringInterval })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {intervals.map((interval) => (
                    <SelectItem key={interval} value={interval}>
                      {INTERVAL_LABELS[interval]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notifications</Label>
              <Select
                value={form.notificationMethod}
                onValueChange={(v) =>
                  setForm({ ...form, notificationMethod: v as NotificationMethod })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NOTIFICATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="robots">Respect robots.txt</Label>
            <Switch
              id="robots"
              checked={form.respectRobots}
              onCheckedChange={(checked) => setForm({ ...form, respectRobots: checked })}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Monitor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
