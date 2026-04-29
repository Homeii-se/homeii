"use client";

/**
 * ChatDrawer — global, drag-bar bottom drawer som visas på alla sidor.
 *
 * Tre snap-positioner:
 *  - PEEK (~84px) — bara titel + grepp synligt, för minimal störning
 *  - HALF (~50% av viewport) — chatta utan att täcka allt innehåll
 *  - FULL (~95% av viewport) — full chat-fokus
 *
 * Fungerar både med och utan användardata. Läser bill/refinement från
 * localStorage så samma drawer kan användas på landningssida, faktura-flöde,
 * resultat-sida och framtida about/kontakt-sidor.
 *
 * Auto-expanderar till HALF när användaren börjar skriva i input-fältet.
 * Klick på greppet togglar mellan PEEK och HALF.
 * Drag på greppet snappar till närmaste position vid release.
 *
 * Persisterar både konversation och senaste höjd i localStorage.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  BillData,
  RefinementAnswers,
  Assumptions,
  ActiveUpgrades,
  SEZone,
  YearlyDataPoint,
  SimulatorState,
} from "../types";

interface ChatContext {
  bill?: BillData;
  refinement?: RefinementAnswers;
  seZone?: SEZone;
  assumptions?: Assumptions;
  activeUpgrades?: ActiveUpgrades;
  yearlyComparison?: YearlyDataPoint[];
}

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
  isStreaming?: boolean;
}

const STORAGE_KEY_HEIGHT = "homeii-chat-drawer-height";
const STORAGE_KEY_PREFIX = "homeii-chat-";
const STORAGE_KEY_GENERAL = "homeii-chat-general";
const SIMULATOR_STATE_KEY = "homeii-state";

const TAB_HEIGHT = 40;
const PEEK_HEIGHT = 64;
const HALF_HEIGHT_VH = 50;
const FULL_HEIGHT_VH = 90;

const SUGGESTED_QUESTIONS_GENERAL = [
  "Vad är skillnaden mellan timspot och månadsspot?",
  "Hur fungerar effektavgift?",
  "Lönar sig solceller i Sverige idag?",
  "Vad var elprisernas extremtopp 2022?",
];

const SUGGESTED_QUESTIONS_WITH_BILL = [
  "Är solceller värt för mig?",
  "Hur mycket sparar jag med en värmepump?",
  "Vad skulle 2022 års priser kostat mig?",
  "Är min förbrukning hög för min hustyp?",
];

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getChatStorageKey(bill?: BillData): string {
  if (!bill || !bill.kwhPerMonth) return STORAGE_KEY_GENERAL;
  const id = `${bill.invoiceYear ?? "x"}-${bill.invoiceMonth ?? "x"}-${bill.kwhPerMonth}-${Math.round(bill.costPerMonth)}`;
  return `${STORAGE_KEY_PREFIX}${id}`;
}

/** Läs simulator-state från localStorage så chatten har user context. */
function readContextFromStorage(): ChatContext {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SIMULATOR_STATE_KEY);
    if (!raw) return {};
    const state = JSON.parse(raw) as SimulatorState;
    if (!state.billData || !state.billData.kwhPerMonth) return {};
    return {
      bill: state.billData,
      refinement: state.refinement,
      seZone: state.seZone,
      assumptions: state.assumptions,
      activeUpgrades: state.activeUpgrades,
    };
  } catch {
    return {};
  }
}

export default function ChatDrawer() {
  const [mounted, setMounted] = useState(false);
  const [context, setContext] = useState<ChatContext>({});
  const [drawerHeight, setDrawerHeight] = useState(PEEK_HEIGHT);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState(800);

  const drawerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dragStateRef = useRef({
    isDragging: false,
    startY: 0,
    startHeight: PEEK_HEIGHT,
    didDrag: false,
  });

  const halfHeight = Math.round((viewportHeight * HALF_HEIGHT_VH) / 100);
  const fullHeight = Math.round((viewportHeight * FULL_HEIGHT_VH) / 100);
  const hasContext = Boolean(context.bill && context.bill.kwhPerMonth > 0);
  const storageKey = getChatStorageKey(context.bill);

  // Mount + viewport-mätning
  useEffect(() => {
    setMounted(true);
    setViewportHeight(window.innerHeight);
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Läs context från localStorage + lyssna på storage-events (när annan flik
  // uppdaterar bill-data eller när simulator-state ändras inom samma flik)
  useEffect(() => {
    if (!mounted) return;
    setContext(readContextFromStorage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === SIMULATOR_STATE_KEY) {
        setContext(readContextFromStorage());
      }
    };
    window.addEventListener("storage", onStorage);
    // Kolla periodiskt också för same-tab updates (storage-event triggas inte i samma flik)
    const interval = setInterval(() => {
      const next = readContextFromStorage();
      setContext((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(next)) return next;
        return prev;
      });
    }, 2000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, [mounted]);

  // Ladda meddelanden från localStorage när storage-key ändras (= ny faktura eller skifte general/bill)
  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setMessages(JSON.parse(raw) as UIMessage[]);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  }, [mounted, storageKey]);

  // Spara meddelanden till localStorage
  useEffect(() => {
    if (!mounted || messages.length === 0) return;
    const stable = messages.filter((m) => !m.isStreaming);
    if (stable.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(stable));
    } catch {
      // Full storage — skippa
    }
  }, [messages, mounted, storageKey]);

  // Persistera drawer-höjd
  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HEIGHT);
      if (saved) {
        const h = Number(saved);
        if (h >= PEEK_HEIGHT && h <= fullHeight) {
          setDrawerHeight(h);
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY_HEIGHT, String(drawerHeight));
    } catch {
      // ignore
    }
  }, [drawerHeight, mounted]);

  // Auto-scroll i meddelandelistan
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  // Snappa till närmaste höjdpunkt — TAB är nu lägsta möjliga
  const snapTo = useCallback(
    (target: number) => {
      const clamped = Math.max(TAB_HEIGHT, Math.min(fullHeight, target));
      setDrawerHeight(clamped);
    },
    [fullHeight]
  );

  const snapToNearest = useCallback(
    (h: number) => {
      const targets = [TAB_HEIGHT, PEEK_HEIGHT, halfHeight, fullHeight];
      let best = targets[0];
      let dist = Math.abs(h - targets[0]);
      for (const t of targets) {
        const d = Math.abs(h - t);
        if (d < dist) {
          best = t;
          dist = d;
        }
      }
      snapTo(best);
    },
    [halfHeight, fullHeight, snapTo]
  );

  // Drag-handlers
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.currentTarget as HTMLDivElement;
      target.setPointerCapture(e.pointerId);
      dragStateRef.current = {
        isDragging: true,
        startY: e.clientY,
        startHeight: drawerHeight,
        didDrag: false,
      };
    },
    [drawerHeight]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragStateRef.current;
      if (!ds.isDragging) return;
      const dy = ds.startY - e.clientY;
      if (Math.abs(dy) > 4) ds.didDrag = true;
      const next = Math.max(TAB_HEIGHT, Math.min(fullHeight, ds.startHeight + dy));
      setDrawerHeight(next);
    },
    [fullHeight]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragStateRef.current;
      if (!ds.isDragging) return;
      ds.isDragging = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (ds.didDrag) {
        snapToNearest(drawerHeight);
      } else {
        // Klick (utan drag) — kontextkänslig toggle:
        //  TAB → HALF (öppna chatten)
        //  PEEK → HALF (öppna chatten)
        //  HALF → PEEK (kollapsa till sammanfattning)
        //  FULL → PEEK (kollapsa till sammanfattning)
        if (drawerHeight <= TAB_HEIGHT + 10) {
          snapTo(halfHeight);
        } else if (drawerHeight <= PEEK_HEIGHT + 20) {
          snapTo(halfHeight);
        } else {
          snapTo(PEEK_HEIGHT);
        }
      }
    },
    [drawerHeight, snapTo, snapToNearest, halfHeight]
  );

  // Auto-expand till halv när input fokuseras
  const handleInputFocus = useCallback(() => {
    if (drawerHeight < halfHeight - 40) {
      snapTo(halfHeight);
    }
  }, [drawerHeight, halfHeight, snapTo]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      setInput("");

      const userMsg: UIMessage = { id: newId(), role: "user", text: trimmed };
      const assistantId = newId();
      const assistantMsg: UIMessage = {
        id: assistantId,
        role: "assistant",
        text: "",
        toolCalls: [],
        isStreaming: true,
      };

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
            context: hasContext ? context : null,
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
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "text") {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + evt.text } : m))
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
              // ignore
            }
          }
        }

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
    [messages, isLoading, context, hasContext]
  );

  const handleClearChat = useCallback(() => {
    if (confirm("Rensa hela konversationen?")) {
      setMessages([]);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }, [storageKey]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!mounted) return null;

  const expansion = Math.max(0, (drawerHeight - PEEK_HEIGHT) / (fullHeight - PEEK_HEIGHT));
  const showSuggestions = messages.length === 0;
  const suggestions = hasContext ? SUGGESTED_QUESTIONS_WITH_BILL : SUGGESTED_QUESTIONS_GENERAL;

  return (
    <>
      {/* Backdrop när drawer är expanderad */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `rgba(0,0,0,${(expansion * 0.25).toFixed(2)})`,
          pointerEvents: expansion > 0.5 ? "auto" : "none",
          transition: "background 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
          zIndex: 40,
        }}
        onClick={() => snapTo(PEEK_HEIGHT)}
        aria-hidden
      />

      {/* Container — flexbox för att centrera drawern på desktop. Padding på parent
          istället för margin på child så total bredd aldrig överskrider viewport. */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          justifyContent: "center",
          padding: "0 12px",
          boxSizing: "border-box",
          pointerEvents: "none",
          zIndex: 50,
        }}
      >
      {/* Drawer */}
      <div
        ref={drawerRef}
        style={{
          pointerEvents: "auto",
          width: "100%",
          maxWidth: 540,
          boxSizing: "border-box",
          height: `${drawerHeight}px`,
          background: "linear-gradient(180deg, #eaf2e8 0%, #f0f6ed 100%)",
          borderTop: "0.5px solid rgba(46,125,82,0.25)",
          borderLeft: "0.5px solid rgba(46,125,82,0.25)",
          borderRight: "0.5px solid rgba(46,125,82,0.25)",
          borderBottom: "none",
          borderRadius: "16px 16px 0 0",
          boxShadow: "0 -2px 16px rgba(46,125,82,0.12)",
          transition: dragStateRef.current.isDragging
            ? "none"
            : "height 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Grepp + header — kompakt i tab-läge, full i peek/half/full */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            padding: drawerHeight <= TAB_HEIGHT + 10 ? "0 12px" : "10px 16px 8px",
            cursor: "ns-resize",
            userSelect: "none",
            touchAction: "none",
            flexShrink: 0,
            height: drawerHeight <= TAB_HEIGHT + 10 ? `${TAB_HEIGHT}px` : "auto",
            display: drawerHeight <= TAB_HEIGHT + 10 ? "flex" : "block",
            alignItems: drawerHeight <= TAB_HEIGHT + 10 ? "center" : undefined,
            justifyContent: drawerHeight <= TAB_HEIGHT + 10 ? "space-between" : undefined,
            gap: drawerHeight <= TAB_HEIGHT + 10 ? 8 : undefined,
          }}
        >
          {/* Tab-läge: kompakt enradig */}
          {drawerHeight <= TAB_HEIGHT + 10 ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#2e7d52",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  H
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#1a3a26" }}>Energy Buddy</span>
                <span style={{ fontSize: 11, color: "#4a6b54" }}>· Klicka för att chatta</span>
              </div>
              <span style={{ fontSize: 14, color: "#2e7d52" }}>↑</span>
            </>
          ) : (
            <>
          <div
            style={{
              width: 40,
              height: 4,
              background: "rgba(0,0,0,0.15)",
              borderRadius: 2,
              margin: "0 auto 10px",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                margin: 0,
                color: "#1a3a26",
                minWidth: 0,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ color: "#1a5e3a" }}>Energy Buddy</span>
              <span style={{ color: "#4a6b54", fontWeight: 400 }}> — din personlige energirådgivare</span>
            </p>
            <div
              style={{
                fontSize: 13,
                color: "#2e7d52",
                transform: `rotate(${expansion * 180}deg)`,
                transition: "transform 0.3s",
                flexShrink: 0,
              }}
            >
              ↑
            </div>
          </div>
            </>
          )}
        </div>

        {/* Chat-content (synlig när drawer är minst halvöppen) */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            opacity: Math.min(1, expansion * 1.5),
            transition: "opacity 0.25s",
            pointerEvents: expansion > 0.1 ? "auto" : "none",
          }}
        >
          {/* Header: clear-knapp */}
          {messages.length > 0 && (
            <div style={{ padding: "0 16px 4px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleClearChat}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted, #707070)",
                  fontSize: 11,
                  cursor: "pointer",
                  padding: "2px 6px",
                }}
              >
                Rensa
              </button>
            </div>
          )}

          {/* Initial greeting */}
          {messages.length === 0 && (
            <div style={{ padding: "8px 16px 4px" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Avatar />
                <div
                  style={{
                    flex: 1,
                    background: "white",
                    border: "0.5px solid rgba(46,125,82,0.15)",
                    borderRadius: "14px",
                    borderTopLeftRadius: 4,
                    padding: "10px 14px",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "#1a3a26",
                  }}
                >
                  Hej! Vad vill du veta mer om?
                </div>
              </div>
            </div>
          )}

          {/* Meddelanden */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "8px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minWidth: 0,
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            {messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} text={m.text} />
              ) : (
                <AssistantBubble
                  key={m.id}
                  text={m.text}
                  toolCalls={m.toolCalls}
                  isStreaming={m.isStreaming}
                />
              )
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested questions */}
          {showSuggestions && (
            <div
              style={{
                padding: "8px 16px 4px",
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {suggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isLoading}
                  style={{
                    background: "rgba(46,125,82,0.08)",
                    color: "var(--brand-700, #1a5e3a)",
                    border: "1px solid rgba(46,125,82,0.2)",
                    borderRadius: 14,
                    padding: "5px 10px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div
              style={{
                margin: "0 16px 4px",
                padding: "6px 10px",
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: 11,
              }}
            >
              {error}
            </div>
          )}

          {/* Input-fält */}
          <div
            style={{
              padding: "8px 16px 14px",
              borderTop: "0.5px solid rgba(46,125,82,0.15)",
              display: "flex",
              gap: 6,
              alignItems: "flex-end",
              flexShrink: 0,
              minWidth: 0,
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              placeholder={hasContext ? "Fråga om din elkostnad..." : "Fråga om svensk elmarknad..."}
              rows={1}
              disabled={isLoading}
              style={{
                flex: "1 1 0",
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                resize: "none",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                padding: "8px 12px",
                // 16px MÅSTE användas för att iOS Safari inte ska auto-zooma
                // när användaren fokuserar fältet (vilket bryter layouten)
                fontSize: 16,
                fontFamily: "inherit",
                minHeight: 36,
                maxHeight: 100,
                outline: "none",
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              style={{
                flexShrink: 0,
                background: "var(--cta-orange, #e97a2c)",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "0 14px",
                height: 36,
                fontSize: 13,
                fontWeight: 600,
                cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
                opacity: isLoading || !input.trim() ? 0.5 : 1,
              }}
            >
              {isLoading ? "..." : "Skicka"}
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Avatar() {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        flexShrink: 0,
        borderRadius: "50%",
        background: "var(--brand-500, #2E7D52)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: 600,
        fontSize: 11,
      }}
    >
      H
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", minWidth: 0 }}>
      <div
        style={{
          maxWidth: "85%",
          minWidth: 0,
          background: "var(--brand-500, #2E7D52)",
          color: "white",
          borderRadius: 14,
          borderTopRightRadius: 4,
          padding: "8px 12px",
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
      >
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
  const showThinking = isStreaming && text.length === 0 && (!toolCalls || toolCalls.length === 0);

  return (
    <div style={{ display: "flex", gap: 8, width: "100%", minWidth: 0 }}>
      <Avatar />
      <div style={{ flex: 1, minWidth: 0, maxWidth: "85%" }}>
        {toolCalls && toolCalls.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            {toolCalls.map((t, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #fcd34d",
                  borderRadius: 6,
                  padding: "2px 6px",
                  fontSize: 10,
                  marginRight: 4,
                  marginBottom: 2,
                }}
              >
                ⚙ {toolLabel(t.name)}
              </span>
            ))}
          </div>
        )}
        {(text.length > 0 || showThinking) && (
          <div
            style={{
              background: "rgba(0,0,0,0.04)",
              borderRadius: 14,
              borderTopLeftRadius: 4,
              padding: "8px 12px",
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            {showThinking ? <ThinkingDots /> : text}
            {isStreaming && text.length > 0 && (
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 14,
                  marginLeft: 2,
                  background: "rgba(0,0,0,0.4)",
                  verticalAlign: "middle",
                  animation: "pulse 1s infinite",
                }}
              />
            )}
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
    <span style={{ display: "inline-flex", gap: 4 }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.3)",
          animation: "bounce 1s infinite",
        }}
      />
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.3)",
          animation: "bounce 1s infinite 0.15s",
        }}
      />
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.3)",
          animation: "bounce 1s infinite 0.3s",
        }}
      />
    </span>
  );
}
