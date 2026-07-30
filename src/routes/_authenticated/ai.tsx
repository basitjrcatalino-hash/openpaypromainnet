import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUp, ChevronLeft, MoreVertical } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import novaAvatar from "@/assets/openpay-pro-mark.png";


export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "Nova AI Assistant — OpenPay Pro Wallet" },
      {
        name: "description",
        content:
          "Chat with Nova, the OpenPay Pro AI assistant. Ask about wallets, top ups, sending OUSD, OpenToken, the ledger, KYC and connecting AI agents over MCP.",
      },
      { property: "og:title", content: "Nova AI Assistant — OpenPay Pro Wallet" },
      {
        property: "og:description",
        content: "Ask Nova anything about OpenPay Pro and OpenPay — balances, top ups, transfers and agent connections.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiAssistantPage,
});

const SUGGESTIONS = [
  "How do I top up my wallet?",
  "How do I send OUSD to an @username?",
  "What is the OpenPay Pro ledger?",
  "How do I connect ChatGPT to my wallet?",
];

function messageText(parts: Array<{ type: string; text?: string }>) {
  return parts.map((p) => (p.type === "text" ? (p.text ?? "") : "")).join("");
}

function AiAssistantPage() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onError: (e) => toast.error(e.message || "Nova is unavailable right now"),
  });

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function submit(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    void sendMessage({ text: value });
    setInput("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-2xl flex-col md:h-[calc(100dvh-6rem)]">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border/60 pb-3">
        <Link
          to="/dashboard"
          className="grid h-9 w-9 place-items-center rounded-full bg-muted/60 text-foreground press"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground press"
          aria-label="More"
          onClick={() => toast("Nova answers questions about OpenPay Pro and OpenPay.")}
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        <img
          src={novaAvatar}
          alt="Nova assistant"
          width={512}
          height={512}
          loading="lazy"
          className="h-8 w-8 rounded-full"
        />
        <span className="text-base font-bold">Nova</span>
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            setInput("");
            inputRef.current?.focus();
          }}
          className="ml-auto rounded-full border border-border/70 px-4 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground press"
        >
          End chat
        </button>
      </header>

      {/* Transcript */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <img
              src={novaAvatar}
              alt="Nova assistant"
              width={512}
              height={512}
              className="h-24 w-24 rounded-full"
            />
            <h1 className="text-2xl font-bold">Nova</h1>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Responses may not always be accurate. Nova is trained on OpenPay Pro and OpenPay
              features — it cannot see your balances or move funds.
            </p>
            <div className="mt-2 grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-2xl border border-border/70 bg-card/50 px-4 py-3 text-left text-sm font-medium text-foreground hover:border-primary/50 press"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((m) => {
              const text = messageText(m.parts as Array<{ type: string; text?: string }>);
              if (m.role === "user") {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-4 py-2.5 text-sm font-medium leading-relaxed text-primary-foreground">
                      {text}
                    </div>
                  </div>
                );
              }
              return (
                <div key={m.id} className="flex gap-3">
                  <img
                    src={novaAvatar}
                    alt=""
                    width={512}
                    height={512}
                    loading="lazy"
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-full"
                  />
                  <div className="prose prose-sm dark:prose-invert min-w-0 max-w-none text-sm leading-relaxed text-foreground">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                </div>
              );
            })}
            {status === "submitted" ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <img
                  src={novaAvatar}
                  alt=""
                  width={512}
                  height={512}
                  loading="lazy"
                  className="h-7 w-7 rounded-full"
                />
                <span className="animate-pulse">Thinking…</span>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="sticky bottom-0 pb-2 pt-2"
      >
        <div className="flex items-end gap-2 rounded-3xl border border-border/70 bg-card/70 p-2 pl-4 backdrop-blur">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder="Message…"
            className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send message"
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground press",
              (busy || !input.trim()) && "opacity-40",
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
