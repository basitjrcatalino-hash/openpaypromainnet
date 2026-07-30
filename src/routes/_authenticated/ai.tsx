import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUp, ChevronLeft, MoreVertical } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { OPENPAY_AUTH_LOGO } from "@/lib/openpay-auth";

/** OpenPay AI assistant avatar (official OpenPay logo). */
const AI_AVATAR = OPENPAY_AUTH_LOGO;


export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "OpenPay AI Assistant — OpenPay Pro Wallet" },
      {
        name: "description",
        content:
          "Chat with OpenPay AI, the OpenPay Pro assistant. Ask about wallets, top ups, sending OUSD, OpenToken, the ledger, KYC and connecting AI agents over MCP.",
      },
      { property: "og:title", content: "OpenPay AI Assistant — OpenPay Pro Wallet" },
      {
        property: "og:description",
        content: "Ask OpenPay AI anything about OpenPay Pro and OpenPay — balances, top ups, transfers and agent connections.",
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
    onError: (e) => toast.error(e.message || "OpenPay AI is unavailable right now"),
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
          onClick={() => toast("OpenPay AI answers questions about OpenPay Pro and OpenPay.")}
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        <img
          src={AI_AVATAR}
          alt="OpenPay AI assistant"
          width={512}
          height={512}
          loading="lazy"
          className="h-8 w-8 rounded-[0.6rem]"
        />
        <span className="text-base font-bold">OpenPay AI</span>
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
              src={AI_AVATAR}
              alt="OpenPay AI assistant"
              width={512}
              height={512}
              className="h-20 w-20 rounded-[1.4rem] shadow-lg"
            />
            <h1 className="text-2xl font-bold">OpenPay AI</h1>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Responses may not always be accurate. OpenPay AI is trained on OpenPay Pro and
              OpenPay features — it cannot see your balances or move funds.
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
                    src={AI_AVATAR}
                    alt=""
                    width={512}
                    height={512}
                    loading="lazy"
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-[0.6rem]"
                  />
                  <OpenPayMarkdown text={text} />

                </div>
              );
            })}
            {status === "submitted" ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <img
                  src={AI_AVATAR}
                  alt=""
                  width={512}
                  height={512}
                  loading="lazy"
                  className="h-7 w-7 rounded-[0.6rem]"
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

/**
 * Claude-style answer typography: generous line height, clear heading rhythm,
 * readable lists, soft code blocks and bordered tables.
 */
function OpenPayMarkdown({ text }: { text: string }) {
  return (
    <div className="min-w-0 max-w-none text-[15px] leading-[1.75] tracking-[-0.005em] text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
          h1: ({ children }) => (
            <h1 className="mb-3 mt-6 text-xl font-bold tracking-tight first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2.5 mt-6 text-[17px] font-bold tracking-tight first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-5 text-[15px] font-bold tracking-tight first:mt-0">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-1.5 pl-5 marker:text-muted-foreground last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-1.5 pl-5 marker:text-muted-foreground last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-4 border-l-2 border-primary/40 pl-4 text-muted-foreground last:mb-0">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-border/60" />,
          code: ({ className, children }) => {
            const isBlock = Boolean(className?.includes("language-"));
            if (!isBlock) {
              return (
                <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">
                  {children}
                </code>
              );
            }
            return (
              <code className="block whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">
                {children}
              </code>
            );
          },
          pre: ({ children }: { children?: ReactNode }) => (
            <pre className="mb-4 overflow-x-auto rounded-2xl border border-border/60 bg-muted/60 p-4 last:mb-0">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto last:mb-0">
              <table className="w-full border-collapse overflow-hidden rounded-xl border border-border/60 text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border/60 bg-muted/50 px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-b border-border/40 px-3 py-2 align-top">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
