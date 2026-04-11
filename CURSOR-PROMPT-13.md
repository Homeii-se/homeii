# CURSOR-PROMPT-13: Fix PDF parsing — use Claude's native PDF support

## Problem
`pdf-parse` v2 requires a pdfjs-dist Web Worker (`pdf.worker.mjs`) that Next.js/Turbopack cannot bundle on the server side. The error is:
```
Setting up fake worker failed: Cannot find module '...\.next\dev\server\chunks\pdf.worker.mjs'
```

## Solution
**Remove pdf-parse entirely.** Claude's Messages API supports PDF documents natively — we can send the raw PDF as a base64 document, just like we already do for images. This is actually *better* because Claude sees the full invoice layout, not just extracted text.

## Changes

### 1. Update `app/api/parse-invoice/route.ts`

Replace the entire file with this logic:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    // Determine the media type for Claude's API
    let mediaType: string;
    if (file.type === "application/pdf") {
      mediaType = "application/pdf";
    } else if (file.type.startsWith("image/")) {
      mediaType = file.type; // e.g. "image/png", "image/jpeg"
    } else {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    // --- system prompt and user message stay EXACTLY as they are now ---
    // (copy the existing systemPrompt and userMessage verbatim from the current file)

    // Build the content array — works for BOTH PDFs and images
    const contentBlock = file.type === "application/pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: file.type, data: base64 } };

    const messages = [
      {
        role: "user",
        content: [
          contentBlock,
          { type: "text", text: userMessage },
        ],
      },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Anthropic API ${response.status}: ${errorText.slice(0, 200)}` },
        { status: 500 }
      );
    }

    const result = await response.json();
    const textContent = result.content?.find(
      (c: { type: string; text?: string }) => c.type === "text"
    )?.text ?? "";

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse LLM response" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Parse invoice error:", message, error);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
```

Key changes:
- **No more `pdf-parse` import** — removed entirely
- **No more `extractedText` variable** — PDFs go straight to Claude as documents
- **PDF uses `type: "document"`** with `media_type: "application/pdf"` — this is Claude's native PDF support
- **Images still use `type: "image"`** as before
- **The `systemPrompt` and `userMessage` variables stay exactly as they are** in the current file — copy them verbatim

### 2. Remove pdf-parse dependency

Run in terminal:
```bash
npm uninstall pdf-parse
```

### 3. Verify

Run `npx tsc --noEmit --skipLibCheck` — should have no errors in route.ts.

## IMPORTANT
- Do NOT change the systemPrompt or userMessage — they are correct as-is
- Do NOT truncate any part of the file — the complete route.ts should be ~100 lines
- The `type: "document"` content block is the key difference for PDFs
