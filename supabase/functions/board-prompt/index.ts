import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { rooms, palette, materials, inspirationCount, prompt, messages } = body;

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const boardContext = buildBoardContext({ rooms, palette, materials, inspirationCount });

    const systemPrompt = `You are a co-designer working alongside an interior designer on a renovation project. You are collaborative, specific, and grounded in what's actually on their board. Your tone is like a skilled colleague—direct, warm, and practical. Never be sycophantic.

${boardContext}

When you want to suggest adding a note to the board, include it at the end of your message exactly like this (only when genuinely useful):
ACTION_ADD_NOTE: [the exact text for the note]

Keep responses concise—2-4 sentences unless more detail is clearly needed. Be specific about what's on the board.`;

    // Build Anthropic-format messages (no system role in array)
    const priorMessages = Array.isArray(messages) ? messages.slice(-20) : [];
    const anthropicMessages = [
      ...priorMessages.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      { role: "user", content: prompt.trim() },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        system: systemPrompt,
        messages: anthropicMessages,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `API error: ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawText: string = data.content?.[0]?.text ?? "";

    // Parse ACTION_ADD_NOTE commands out of the response
    const actions: Array<{ kind: "add_note"; text: string }> = [];
    const actionPattern = /ACTION_ADD_NOTE:\s*\[?(.+?)\]?(?:\n|$)/g;
    let match;
    while ((match = actionPattern.exec(rawText)) !== null) {
      const noteText = match[1].trim();
      if (noteText) actions.push({ kind: "add_note", text: noteText });
    }

    const cleanText = rawText
      .replace(/ACTION_ADD_NOTE:\s*\[?.+?\]?(\n|$)/g, "")
      .trim();

    return new Response(
      JSON.stringify({ text: cleanText || rawText, ...(actions.length ? { actions } : {}) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildBoardContext(digest: {
  rooms?: Array<{ name: string; items: Array<{ kind: string; name?: string; finish?: string; color?: string; status?: string; price?: number }> }>;
  palette?: Array<{ brand?: string; name?: string; hex?: string; sheen?: string; room?: string }>;
  materials?: Array<{ kind?: string; name?: string; supplier?: string; room?: string }>;
  inspirationCount?: number;
}): string {
  const lines: string[] = [];

  const hasContent = (digest.rooms?.some((r) => r.items.length > 0) ?? false) ||
    (digest.palette?.length ?? 0) > 0 ||
    (digest.materials?.length ?? 0) > 0 ||
    (digest.inspirationCount ?? 0) > 0;

  if (!hasContent) {
    return "The board is currently empty — the designer is starting fresh.";
  }

  lines.push("What's on the board right now:");

  if (digest.rooms?.length) {
    for (const room of digest.rooms) {
      if (room.items.length === 0) continue;
      lines.push(`\n${room.name}:`);
      for (const item of room.items) {
        const parts = [item.kind, item.name, item.finish, item.color, item.status]
          .filter((p): p is string => !!p);
        if (item.price) parts.push(`$${item.price}`);
        lines.push(`  • ${parts.join(" — ")}`);
      }
    }
  }

  if (digest.palette?.length) {
    lines.push("\nPaint & colour palette:");
    for (const p of digest.palette) {
      const parts = [p.brand, p.name, p.hex, p.sheen, p.room ? `(${p.room})` : ""].filter(Boolean);
      lines.push(`  • ${parts.join(" ")}`);
    }
  }

  if (digest.materials?.length) {
    lines.push("\nMaterials & surfaces:");
    for (const m of digest.materials) {
      const parts = [m.kind, m.name, m.supplier, m.room ? `(${m.room})` : ""].filter(Boolean);
      lines.push(`  • ${parts.join(" ")}`);
    }
  }

  if (digest.inspirationCount) {
    lines.push(`\n${digest.inspirationCount} inspiration image${digest.inspirationCount === 1 ? "" : "s"} pinned.`);
  }

  return lines.join("\n");
}
