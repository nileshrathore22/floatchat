import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { getEmbedding } from "@/lib/embeddingClient";

function cosineSimilarity(a: number[], b: number[]) {
  const dot = a.reduce((s, x, i) => s + x * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  const magB = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
  return dot / (magA * magB);
}

export async function POST(req: Request) {
  try {
    await requireAuth(req);
    const { query } = await req.json().catch(() => ({}));

    if (!query) {
      return NextResponse.json({ ok: true, results: [] });
    }

    // 1️⃣ Embed query
    let queryEmbedding: number[];
    try {
      queryEmbedding = await getEmbedding(query);
    } catch (err) {
      console.error("Embedding error:", err);
      return NextResponse.json({ ok: true, results: [] }); // Fallback to empty results
    }

    // 2️⃣ Load messages with embeddings
    const messages = await prisma.message.findMany({
      where: { embedding: { not: null } as any },
      select: {
        id: true,
        content: true,
        embedding: true,
        sessionId: true,
        createdAt: true,
      },
    });

    // 3️⃣ Score
    const scored = messages
      .map((m) => ({
        ...m,
        score: cosineSimilarity(
          queryEmbedding,
          JSON.parse(m.embedding as string)
        ),
      }))
      .filter((m) => m.score > 0.75)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return NextResponse.json({ ok: true, results: scored });
  } catch (e: any) {
    console.error("SEARCH ERROR:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
