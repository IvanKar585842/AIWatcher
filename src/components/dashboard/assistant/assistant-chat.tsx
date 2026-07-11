"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";
import { os } from "@/components/dashboard/os/os-primitives";
import { useToast } from "@/components/ui/os-toast";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: Array<{ content: string; role: string; createdAt: string }>;
  _count?: { messages: number };
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-cyan-400/70"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function AssistantChat() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<"one" | "all" | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming, scrollToBottom]);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/chat/conversations");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.conversations ?? []) as Conversation[];
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/conversations/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.conversation as { messages: ChatMessage[] };
  }, []);

  useEffect(() => {
    loadConversations()
      .then((list) => {
        setConversations(list);
        setActiveId((current) => current ?? list[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    loadConversation(activeId).then((conv) => {
      if (conv) setMessages(conv.messages);
    });
  }, [activeId, loadConversation]);

  async function createConversation() {
    const res = await fetch("/api/chat/conversations", { method: "POST" });
    if (!res.ok) {
      toast("Failed to create conversation", "error");
      return;
    }
    const data = await res.json();
    const conv = data.conversation as Conversation;
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    let conversationId = activeId;

    if (!conversationId) {
      const res = await fetch("/api/chat/conversations", { method: "POST" });
      if (!res.ok) {
        toast("Failed to start conversation", "error");
        return;
      }
      const data = await res.json();
      conversationId = data.conversation.id;
      setConversations((prev) => [data.conversation, ...prev]);
      setActiveId(conversationId);
    }

    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "USER",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInput("");
    setSending(true);
    setStreaming("");

    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send message");
      }

      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setStreaming(full);
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "ASSISTANT",
        content: full,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setStreaming("");

      const list = await loadConversations();
      setConversations(list);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      toast(msg, "error");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setInput(text);
    } finally {
      setSending(false);
      setStreaming("");
    }
  }

  async function renameConversation(id: string) {
    const title = renameValue.trim();
    if (!title) return;

    const res = await fetch(`/api/chat/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (res.ok) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      );
    }
    setRenamingId(null);
    setRenameValue("");
  }

  async function deleteConversation(id: string) {
    const res = await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Failed to delete", "error");
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    setConfirmDelete(null);
  }

  async function deleteAllConversations() {
    const res = await fetch("/api/chat/conversations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE_ALL" }),
    });
    if (!res.ok) {
      toast("Failed to clear history", "error");
      return;
    }
    setConversations([]);
    setActiveId(null);
    setMessages([]);
    setConfirmDelete(null);
    toast("All conversations deleted");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className={os.page}>
      <CommandPageHeader
        label="AI Assistant"
        title="WatchFlow Assistant"
        description="Ask anything about monitoring, settings, notifications, or troubleshooting."
      />

      <div className="relative flex h-[calc(100dvh-11rem)] min-h-[420px] overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] sm:h-[calc(100vh-12rem)] sm:min-h-[520px]">
        {sidebarOpen && (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-black/60 md:hidden"
            aria-label="Close chats"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — drawer on mobile */}
        <aside
          className={cn(
            "absolute inset-y-0 left-0 z-30 flex w-[min(18rem,85vw)] shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0c0c] transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0 md:bg-black/20",
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="border-b border-white/[0.06] p-3">
            <button
              type="button"
              onClick={createConversation}
              className={cn(
                "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                os.btnPrimary
              )}
            >
              <Plus className="h-4 w-4" />
              New chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading && (
              <p className="px-3 py-4 text-center text-xs text-zinc-600">Loading…</p>
            )}
            {!loading && conversations.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-zinc-600">No conversations yet</p>
            )}
            {conversations.map((conv) => (
              <div key={conv.id} className="relative mb-1">
                {renamingId === conv.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => renameConversation(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameConversation(conv.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="w-full rounded-lg border border-cyan-400/30 bg-black/50 px-3 py-2 text-xs text-zinc-100 outline-none"
                  />
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveId(conv.id);
                      setSidebarOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveId(conv.id);
                        setSidebarOpen(false);
                      }
                    }}
                    className={cn(
                      "group flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      activeId === conv.id
                        ? "border border-cyan-400/20 bg-cyan-500/[0.08] text-cyan-100"
                        : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1 truncate">{conv.title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === conv.id ? null : conv.id);
                      }}
                      className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {menuOpen === conv.id && (
                  <div className="absolute right-2 top-10 z-20 w-36 rounded-lg border border-white/[0.08] bg-[#111] py-1 shadow-xl">
                    <button
                      type="button"
                      className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                      onClick={() => {
                        setRenamingId(conv.id);
                        setRenameValue(conv.title);
                        setMenuOpen(null);
                      }}
                    >
                      <Pencil className="h-3 w-3" /> Rename
                    </button>
                    <button
                      type="button"
                      className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
                      onClick={() => {
                        setActiveId(conv.id);
                        setConfirmDelete("one");
                        setMenuOpen(null);
                      }}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {conversations.length > 0 && (
            <div className="border-t border-white/[0.06] p-3">
              <button
                type="button"
                onClick={() => setConfirmDelete("all")}
                className="min-h-10 w-full rounded-lg px-3 py-2 text-xs text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                Clear all history
              </button>
            </div>
          )}
        </aside>

        {/* Main chat */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex min-h-10 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs text-zinc-400"
            >
              <MessageSquare className="h-4 w-4" />
              Chats
            </button>
            <button
              type="button"
              onClick={createConversation}
              className="flex min-h-10 items-center gap-1.5 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 text-xs text-cyan-200"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
            {messages.length === 0 && !streaming && !sending && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex h-full flex-col items-center justify-center text-center"
              >
                <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
                  <span className="absolute inset-0 animate-pulse rounded-2xl bg-cyan-500/20 blur-xl" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10">
                    <Sparkles className="h-8 w-8 text-cyan-400" />
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-zinc-100">How can I help?</h2>
                <p className="mt-2 max-w-md text-sm text-zinc-500">
                  Ask about creating monitors, choosing modes, notifications, billing, or
                  troubleshooting.
                </p>
                <div className="mt-8 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                  {[
                    "What changed today?",
                    "Which changes are important?",
                    "Which websites need attention?",
                    "Why did I receive a notification?",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setInput(q);
                        inputRef.current?.focus();
                      }}
                      className="min-h-12 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3 text-left text-xs text-zinc-400 transition-colors hover:border-cyan-400/20 hover:text-cyan-200"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mb-4 flex gap-3",
                    msg.role === "USER" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "ASSISTANT" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-500/10">
                      <Bot className="h-4 w-4 text-cyan-400" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      msg.role === "USER"
                        ? "border border-cyan-400/20 bg-cyan-500/10 text-cyan-50"
                        : "border border-white/[0.06] bg-white/[0.03] text-zinc-300"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {streaming && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4 flex gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-500/10">
                  <Bot className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="max-w-[85%] rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300">
                  <p className="whitespace-pre-wrap">{streaming}</p>
                </div>
              </motion.div>
            )}

            {sending && !streaming && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/[0.06] bg-black/30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-black/50 p-2 focus-within:border-cyan-400/30 focus-within:ring-1 focus-within:ring-cyan-400/20">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask WatchFlow Assistant…"
                rows={1}
                maxLength={2000}
                disabled={sending}
                className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-base text-zinc-100 placeholder:text-zinc-600 outline-none sm:text-sm"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className={cn(
                  "mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                  input.trim() && !sending
                    ? "border border-cyan-400/30 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                    : "text-zinc-600"
                )}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-center font-mono text-[10px] text-zinc-600">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#111] p-6 shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-zinc-100">
                {confirmDelete === "all" ? "Clear all history?" : "Delete conversation?"}
              </h3>
              <p className="mt-2 text-sm text-zinc-500">
                {confirmDelete === "all"
                  ? "All conversations and messages will be permanently deleted."
                  : "This conversation and all its messages will be permanently deleted."}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-sm text-zinc-400 hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    confirmDelete === "all"
                      ? deleteAllConversations()
                      : activeId && deleteConversation(activeId)
                  }
                  className="flex-1 rounded-xl border border-red-500/30 bg-red-500/15 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/25"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
