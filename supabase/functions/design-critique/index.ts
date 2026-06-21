import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get("OPENAI_API_KEY");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { rooms, palette, materials, inspirationCount, focus } = body;

    const boardContext = buildBoardContext({ rooms, palette, materials, inspirationCount });

    const systemPrompt = `You are a senior interior designer reviewing a colleague's project board. Give a concise, honest, and constructive read of the board — what's working, what's missing, and one or two concrete next steps. Be specific about the actual items on the board. Write in flowing paragraphs, not bullet points. Aim for 3–5 paragraphs.`;

    const userPrompt = focus === "all"
      ? `Please give me a full read of this board:\n\n${boardContext}`
      : `Please critique the ${focus} aspect of this board:\n\n${boardContext}`;

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
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 800,
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
    const critique: string = data.content?.[0]?.text ?? "";

    return new Response(
      JSON.stringify({ critique, generatedAt: new Date().toISOString() }),
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
    return "The board is currently empty.";
  }

  if (digest.rooms?.length) {
    for (const room of digest.rooms) {
      if (room.items.length === 0) continue;
      lines.push(`${room.name}:`);
      for (const item of room.items) {
        const parts = [item.kind, item.name, item.finish, item.color, item.status]
          .filter((p): p is string => !!p);
        if (item.price) parts.push(`$${item.price}`);
        lines.push(`  • ${parts.join(" — ")}`);
      }
      lines.push("");
    }
  }

  if (digest.palette?.length) {
    lines.push("Paint & colour palette:");
    for (const p of digest.palette) {
      const parts = [p.brand, p.name, p.hex, p.sheen, p.room ? `(${p.room})` : ""].filter(Boolean);
      lines.push(`  • ${parts.join(" ")}`);
    }
    lines.push("");
  }

  if (digest.materials?.length) {
    lines.push("Materials & surfaces:");
    for (const m of digest.materials) {
      const parts = [m.kind, m.name, m.supplier, m.room ? `(${m.room})` : ""].filter(Boolean);
      lines.push(`  • ${parts.join(" ")}`);
    }
    lines.push("");
  }

  if (digest.inspirationCount) {
    lines.push(`${digest.inspirationCount} inspiration image${digest.inspirationCount === 1 ? "" : "s"} pinned.`);
  }

  return lines.join("\n");
}
