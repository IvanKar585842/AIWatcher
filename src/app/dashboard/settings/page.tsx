"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Unlink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const [telegram, setTelegram] = useState<{
    linked: boolean;
    telegramUsername: string | null;
    linkUrl: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    fetch("/api/telegram/link")
      .then((r) => r.json())
      .then(setTelegram)
      .finally(() => setLoading(false));
  }, []);

  async function unlinkTelegram() {
    setUnlinking(true);
    await fetch("/api/telegram/link", { method: "DELETE" });
    const data = await fetch("/api/telegram/link").then((r) => r.json());
    setTelegram(data);
    setUnlinking(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and integrations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Telegram Integration</CardTitle>
          <CardDescription>
            Connect your Telegram account to receive instant change notifications and use bot commands.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : telegram?.linked ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="success">Connected</Badge>
                {telegram.telegramUsername && (
                  <span className="text-sm">@{telegram.telegramUsername}</span>
                )}
              </div>
              <Button variant="outline" onClick={unlinkTelegram} disabled={unlinking}>
                {unlinking ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4 mr-2" />
                )}
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Click the button below to open Telegram and link your account.
              </p>
              <a href={telegram?.linkUrl} target="_blank" rel="noopener noreferrer">
                <Button>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect Telegram
                </Button>
              </a>
            </div>
          )}

          <div className="mt-4 p-4 rounded-lg bg-muted/50 text-sm space-y-1">
            <p className="font-medium">Available Bot Commands:</p>
            <p className="text-muted-foreground">/list — View monitors</p>
            <p className="text-muted-foreground">/pause [id] — Pause a monitor</p>
            <p className="text-muted-foreground">/resume [id] — Resume a monitor</p>
            <p className="text-muted-foreground">/delete [id] — Delete a monitor</p>
            <p className="text-muted-foreground">/latest [id] — Latest change</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <CardDescription>
            The AI provider is configured server-side via the AI_PROVIDER environment variable.
            Supported: openai, claude, gemini.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
