/**
 * POST /api/chat
 * ===============
 * Streaming chat endpoint för Homeii AI-rådgivaren.
 *
 * Body: {
 *   messages: Array<{ role: "user" | "assistant", content: string }>,
 *   context: ChatUserContext
 * }
 *
 * Response: text/event-stream (SSE)
 *   data: {"type":"text","text":"..."}
 *   data: {"type":"tool_use","name":"...","input":{...}}
 *   data: {"type":"tool_result","output":{...}}
 *   data: {"type":"done"}
 *
 * Hanterar tool_use: när Claude vill anropa ett verktyg, dispatchar vi det
 * server-side och fortsätter konversationen i en agentic loop tills modellen
 * returnerar end_turn.
 */

import { NextRequest } from "next/server";
import { HOMEII_SYSTEM_PROMPT } from "../../../lib/chat/systemPrompt";
import { buildUserContext, type ChatUserContext } from "../../../lib/chat/buildContext";
import { CHAT_TOOLS, dispatchTool, type ToolDispatchContext } from "../../../lib/chat/tools";

export const runtime = "nodejs";
export const maxDuration = 60; // Tillåt längre svarstid för agentic loops

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

interface ChatMessage {
  role: "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
        | { type: "tool_result"; tool_use_id: string; content: string }
      >;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Saknar ANTHROPIC_API_KEY i miljövariablerna" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { messages: ChatMessage[]; context: ChatUserContext };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Ogiltig JSON i request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, context } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages saknas eller är tom" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Context kan vara null/saknad — då går chatten i "general mode" utan
  // användarspecifika verktyg eller kunddata. Användbart innan användaren
  // har laddat upp en faktura (landningssida, om oss, kontakt etc.).
  const hasUserContext = context && context.bill && context.bill.kwhPerMonth > 0;

  // Bygg system-prompt: statisk kunskap + ev. användarens specifika kontext
  let fullSystemPrompt = HOMEII_SYSTEM_PROMPT;
  if (hasUserContext) {
    fullSystemPrompt += "\n\n" + buildUserContext(context);
  } else {
    fullSystemPrompt += `\n\n# ANVÄNDARENS SITUATION

Användaren har inte laddat upp någon faktura än. Du har därmed ingen specifik
kunddata att referera till. Svara på generella frågor om svensk elmarknad,
solceller, batterier, värmepumpar, energieffektivisering osv. Om användaren
ställer en fråga som kräver deras egen data, uppmuntra dem att ladda upp
en elräkning först — då kan du ge konkreta råd för deras situation.`;
  }

  // Tool dispatch context — bara om vi har bill-data
  const baseUrl = req.nextUrl.origin;
  const toolCtx: ToolDispatchContext | null = hasUserContext
    ? {
        bill: context.bill,
        refinement: context.refinement,
        seZone: context.seZone,
        assumptions: context.assumptions,
        activeUpgrades: context.activeUpgrades,
        baseUrl,
      }
    : null;

  // Streamen som vi skickar till klienten (SSE)
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        // Konversations-state — vi muterar detta i agentic loopen
        const conversation: ChatMessage[] = messages.map((m) => ({ ...m }));

        // Max 5 tool-iterationer för att förhindra oändliga loopar
        const MAX_ITERATIONS = 5;
        let stopReason: string | null = null;

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          // Anropa Claude (icke-streaming i denna iteration — vi streamar text-deltas
          // efter vi sett att modellen inte vill anropa fler tools).
          const response = await fetch(ANTHROPIC_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: MODEL,
              max_tokens: 1500,
              system: fullSystemPrompt,
              messages: conversation,
              // Tools bara när vi har kunddata att räkna på
              ...(toolCtx ? { tools: CHAT_TOOLS } : {}),
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            console.error(`[/api/chat] Anthropic ${response.status}:`, errText.slice(0, 500));
            send({ type: "error", message: `API-fel: ${response.status}` });
            break;
          }

          const result = await response.json();
          stopReason = result.stop_reason;

          // Spara assistentens svar i konversationen för nästa iteration
          const assistantContent = result.content as Array<
            | { type: "text"; text: string }
            | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
          >;

          conversation.push({ role: "assistant", content: assistantContent });

          // Streama ut text-bitar till klienten direkt
          for (const block of assistantContent) {
            if (block.type === "text") {
              send({ type: "text", text: block.text });
            } else if (block.type === "tool_use") {
              send({ type: "tool_use", name: block.name, input: block.input });
            }
          }

          // Om modellen vill anropa verktyg, kör dem och fortsätt loopen
          if (stopReason === "tool_use" && toolCtx) {
            const toolUseBlocks = assistantContent.filter(
              (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
                b.type === "tool_use"
            );

            const toolResults: Array<{
              type: "tool_result";
              tool_use_id: string;
              content: string;
            }> = [];

            for (const toolBlock of toolUseBlocks) {
              try {
                const output = await dispatchTool(toolBlock.name, toolBlock.input, toolCtx);
                send({ type: "tool_result", name: toolBlock.name, output });
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolBlock.id,
                  content: JSON.stringify(output),
                });
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[/api/chat] Tool ${toolBlock.name} failed:`, msg);
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolBlock.id,
                  content: JSON.stringify({ error: msg }),
                });
              }
            }

            // Lägg till tool_results som user-message och loopa
            conversation.push({ role: "user", content: toolResults });
            continue;
          }

          // end_turn eller annat slutskäl — vi är klara
          break;
        }

        if (stopReason === "tool_use") {
          send({
            type: "text",
            text: "\n\n_(Nådde max antal verktygsiterationer — försök gärna formulera om frågan.)_",
          });
        }

        send({ type: "done" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[/api/chat] Unexpected error:", msg);
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
