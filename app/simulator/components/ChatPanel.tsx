"use client";

/**
 * ChatPanel — full-bredd AI-rådgivare för Homeii.
 *
 * Visas som en sektion på resultat-sidan, under simuleringsvyerna.
 * Streamar svar från /api/chat via SSE och stödjer tool_use-blocks
 * (visar "Räknar..." medan tools körs).
 *
 * Persisterar konversationen i localStorage med nyckel kopplad till
 * fakturaperioden så olika fakturauppladdningar får separata trådar.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  BillData,
  RefinementAnswers,
  Assumptions,
  ActiveUpgrades,
  SEZone,
  YearlyDataPoint,
} from "../types";
import { SUGGESTED_QUESTIONS_INITIAL } from "../../../lib/chat/systemPrompt";

interface ChatPanelProps {
  billData: BillData;
  refinement: RefinementAnswers;
  seZone: SEZone;
  assumptions?: Assumptions;
  activeUpgrades?: ActiveUpgrades;
  yearlyComparison?: YearlyDataPoint[];
}

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  /** Klar text efter streaming */
  text: string;
  /** Tool-anrop som modellen gjorde under detta turn */
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
  /** Streaming pågår fortfarande */
  isStreaming?: boolean;
}

const STORAGE_KEY_PREFIX = "homeii-chat-";

function getChatStorageKey(bill: BillData): string {
  // Använd fakturadata som identitet — samma faktura → samma chat
  const id = `${bill.invoiceYear ?? "x"}-${bill.invoiceMonth ?? "x"}-${bill.kwhPerMonth}-${Math.round(bill.costPerMonth)}`;
  return `${STORAGE_KEY_PREFIX}${id}`;
}

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ChatPanel({
  billData,
  refinement,
  seZone,
  assumptions,
  activeUpgrades,
  yearlyComparison,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const storageKey = getChatStorageKey(billData);

  // Ladda från localStorage vid mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as UIMessage[];
        setMessages(saved);
      }
    } catch {
      // Korrupt state — börja om
    }
  }, [storageKey]);

  // Spara till localStorage när messages ändras (men inte när bara streaming-text uppdateras)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (messages.length === 0) return;
    // Spara bara klara meddelanden (inte streaming-pågående)
    const stable = messages.filter((m) => !m.isStreaming);
    if (stable.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(stable));
    } catch {
      // localStorage full — skippa
    }
  }, [messages, storageKey]);

  // Auto-scroll till botten när nya meddelanden kommer
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      setInput("");
      const userMsg: UIMessage = {
        id: newId(),
        role: "user",
        text: trimmed,
      };
      const assistantId = newId();
      const assistantMsg: UIMessage = {
        id: assistantId,
        role: "assistant",
        text: "",
        toolCalls: [],
        isStreaming: true,
      };

      // Snapshot pre-update conversation för att skicka till API
      const apiMessages = [
        ...messages.filter((m) => !m.isStreaming).map((m) => ({ role: m.role, content: m.text })),
        { role: "user" as const, content: trimmed },
      ];

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            context: {
              bill: billData,
              refinement,
              seZone,
              assumptions,
              activeUpgrades,
              yearlyComparison,
            },
          }),
        });

        if (!res.ok || !res.body) {
          const txt = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE event-delimiter är dubbelt linjebryt
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? ""; // sista (ofullständiga) raden behåller vi

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "text") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, text: m.text + evt.text } : m
                  )
                );
              } else if (evt.type === "tool_use") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, toolCalls: [...(m.toolCalls ?? []), { name: evt.name, input: evt.input }] }
                      : m
                  )
                );
              } else if (evt.type === "error") {
                setError(evt.message ?? "Något gick fel");
              } else if (evt.type === "done") {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
                );
              }
            } catch {
              // Ignorera korrupta SSE-events
            }
          }
        }

        // Säkerhetsnät: säkerställ att meddelandet markeras som klart
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, text: m.text || "Tyvärr, jag kunde inte svara just nu. Försök igen om en stund.", isStreaming: false }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, billData, refinement, seZone, assumptions, activeUpgrades, yearlyComparison]
  );

  const handleClearChat = () => {
    if (confirm("Rensa hela konversationen?")) {
      setMessages([]);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const showSuggestions = messages.length === 0;

  return (
    <div className="card-strong rounded-2xl p-5 mb-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            AI-rådgivare
          </p>
          <h3 className="mt-0.5 text-lg font-semibold text-text-primary">Prata med din analys</h3>
          <p className="mt-1 text-xs text-text-muted">
            Fråga om besparingar, jämför scenarier, eller förstå komponenterna i din elkostnad.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-gray-100 hover:text-text-secondary"
            title="Rensa konversationen"
          >
            Rensa
          </button>
        )}
      </div>

      {/* Initial greeting (innan första meddelandet) */}
      {messages.length === 0 && (
        <div className="mb-4 flex gap-2">
          <Avatar />
          <div className="flex-1 rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-2.5 text-sm text-text-primary">
            Hej! Jag har analyserat din elräkning. Vad vill du veta mer om?
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="mb-3 space-y-3">
        {messages.map((m) =>
          m.role === "user" ? (
            <UserBubble key={m.id} text={m.text} />
          ) : (
            <AssistantBubble key={m.id} text={m.text} toolCalls={m.toolCalls} isStreaming={m.isStreaming} />
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions (bara innan första meddelandet) */}
      {showSuggestions && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS_INITIAL.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 hover:border-brand-300 transition-all disabled:opacity-50"
              disabled={isLoading}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Fråga något om din elkostnad..."
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-text-primary focus:border-brand-500 focus:outline-none disabled:bg-gray-50 disabled:opacity-60"
          style={{ minHeight: "40px", maxHeight: "120px" }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim()}
          className="rounded-xl bg-cta-orange px-4 py-2 text-sm font-semibold text-white shadow hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? "..." : "Skicka"}
        </button>
      </div>

      <p className="mt-2 text-[10px] text-text-muted">
        AI kan göra misstag — verifiera viktiga beslut med en certifierad installatör.
      </p>
    </div>
  );
}

// ============================================================
// Underkomponenter
// ============================================================

function Avatar() {
  return (
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
      H
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-500 px-4 py-2 text-sm text-white whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({
  text,
  toolCalls,
  isStreaming,
}: {
  text: string;
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
  isStreaming?: boolean;
}) {
  const hasContent = text.length > 0 || (toolCalls && toolCalls.length > 0);
  const showThinkingIndicator = isStreaming && !hasContent;

  return (
    <div className="flex gap-2">
      <Avatar />
      <div className="flex-1 max-w-[85%]">
        {/* Tool calls (om det är några) */}
        {toolCalls && toolCalls.length > 0 && (
          <div className="mb-1.5 space-y-1">
            {toolCalls.map((t, i) => (
              <div
                key={i}
                className="inline-block rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] text-amber-700 mr-1"
              >
                ⚙ {toolLabel(t.name)}
              </div>
            ))}
          </div>
        )}

        {/* Text-content */}
        {(text.length > 0 || showThinkingIndicator) && (
          <div className="rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-2.5 text-sm text-text-primary whitespace-pre-wrap">
            {showThinkingIndicator ? <ThinkingDots /> : text}
            {isStreaming && text.length > 0 && <span className="inline-block w-1.5 h-4 ml-0.5 bg-text-muted animate-pulse" />}
          </div>
        )}
      </div>
    </div>
  );
}

function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    get_yearly_comparison: "Hämtar 8-årsjämförelse",
    get_spot_price_summary: "Hämtar prisnivå",
    simulate_with_upgrade: "Simulerar uppgradering",
    get_historical_day_prices: "Hämtar dagspriser",
  };
  return labels[name] ?? `Använder ${name}`;
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}
