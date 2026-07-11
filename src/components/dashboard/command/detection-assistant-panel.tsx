"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bot, Loader2, MessageSquare, Send, Sparkles, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/os-toast";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
}

const SUGGESTIONS = [
  "What changed today?",
  "Which changes are important?",
  "Which websites need attention?",
  "Why did I receive a notification?",
];

/**
 * Compact AI chat for the Detection / Command Center dashboard.
 * Reuses existing /api/chat routes — no separate backend.
 */
export function DetectionAssistantPanel() {
  const { toast } = useToast();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (conversationId) return conversationId;

    const res = await fetch("/api/chat/conversations", { method: "POST" });
    if (!res.ok) {
      setError("Could not start chat. Try again.");
      return null;
    }
    const data = await res.json();
    const id = data.conversation?.id as string | undefined;
    if (!id) {
      setError("Could not start chat.");
      return null;
    }
    setConversationId(id);
    return id;
  }, [conversationId]);

  useEffect(() => {
    // Prefer an existing recent conversation titled for detections, else idle until first send
    fetch("/api/chat/conversations")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = (data?.conversations ?? []) as Array<{
          id: string;
          title: string;
        }>;
        const preferred =
          list.find((c) => /detection|what changed|today/i.test(c.title)) ?? list[0];
        if (preferred) {
          setConversationId(preferred.id);
          return fetch(`/api/chat/conversations/${preferred.id}`).then((r) =>
            r.ok ? r.json() : null
          );
        }
        return null;
      })
      .then((detail) => {
        if (detail?.conversation?.messages) {
          setMessages(detail.conversation.messages);
        }
      })
      .catch(() => {})
      .finally(() => setBooting(false));
  }, []);

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    setError("");
    setSending(true);
    setInput("");

    const id = await ensureConversation();
    if (!id) {
      setSending(false);
      return;
    }

    const tempUserId = `temp-user-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "USER", content },
    ]);

    try {
      const res = await fetch(`/api/chat/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to send message");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setStreaming(full);
      }

      setStreaming("");
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserId),
        { id: `user-${Date.now()}`, role: "USER", content },
        {
          id: `asst-${Date.now()}`,
          role: "ASSISTANT",
          content: full.replace(/\n\n\[Error:[\s\S]*\]$/, "").trim() || full,
        },
      ]);

      if (full.includes("[Error:")) {
        setError("The assistant hit an error. Check Settings / API key if this persists.");
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
      const message = err instanceof Error ? err.message : "Failed to send";
      setError(message);
      toast(message, "error");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function clearChat() {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const res = await fetch(`/api/chat/conversations/${conversationId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast("Could not clear conversation", "error");
      return;
    }
    setConversationId(null);
    setMessages([]);
    setStreaming("");
    setError("");
    toast("Conversation cleared", "success");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="flex h-[240px] max-h-[240px] flex-col overflow-hidden rounded-2xl border border-cyan-500/15 bg-white/[0.02]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
            <h3 className="text-sm font-medium text-zinc-100">Detection Assistant</h3>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-zinc-500">
            Ask about your monitors, changes, and alerts
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void clearChat()}
            className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <Link
            href="/dashboard/assistant"
            className="flex min-h-9 items-center gap-1.5 rounded-lg border border-white/[0.06] px-2.5 text-[11px] text-zinc-400 hover:border-cyan-400/20 hover:text-cyan-200"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Full chat
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {booting && (
          <p className="py-8 text-center text-xs text-zinc-600">Loading assistant…</p>
        )}

        {!booting && messages.length === 0 && !streaming && !sending && (
          <div className="flex h-full min-h-0 flex-col justify-center py-2">
            <div className="mb-2 flex justify-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10">
                <Bot className="h-4 w-4 text-cyan-400" />
              </div>
            </div>
            <p className="text-center text-[11px] text-zinc-500">
              I can read your detections and explain what matters.
            </p>
            <div className="mt-3 grid gap-1.5">
              {SUGGESTIONS.slice(0, 3).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendMessage(q)}
                  className="min-h-9 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-1.5 text-left text-[11px] text-zinc-400 transition-colors hover:border-cyan-400/20 hover:text-cyan-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "USER" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[92%] rounded-2xl px-3 py-2 text-xs leading-relaxed sm:text-sm",
                msg.role === "USER"
                  ? "border border-cyan-400/20 bg-cyan-500/10 text-cyan-50"
                  : "border border-white/[0.06] bg-white/[0.03] text-zinc-300"
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-zinc-300 sm:text-sm">
              <p className="whitespace-pre-wrap">{streaming}</p>
            </div>
          </div>
        )}

        {sending && !streaming && (
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
            Analyzing your detections…
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-end gap-2 rounded-xl border border-white/[0.08] bg-black/40 p-1.5 focus-within:border-cyan-400/30">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your detections…"
            rows={1}
            maxLength={2000}
            disabled={sending}
            className="max-h-24 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={sending || !input.trim()}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
              input.trim() && !sending
                ? "border border-cyan-400/30 bg-cyan-500/20 text-cyan-300"
                : "text-zinc-600"
            )}
            aria-label="Send"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </motion.section>
  );
}
