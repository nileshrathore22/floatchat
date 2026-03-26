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
    const decoded = await requireAuth(req);
    const { query } = await req.json().catch(() => ({}));

    if (!query) {
      return NextResponse.json({ ok: true, results: [] });
    }

    let queryEmbedding: number[];
    try {
      queryEmbedding = await getEmbedding(query);
    } catch (err) {
      console.error("Embedding error:", err);
      return NextResponse.json({ ok: true, results: [] }); 
    }

    // Isolate Search exclusively to this user's sessions to prevent data leakage
    const userSessions = await prisma.session.findMany({
      where: { userId: decoded.uid },
      select: { id: true }
    });
    const sessionIds = userSessions.map(s => s.id);

    const messages = await prisma.message.findMany({
      where: { 
        embedding: { not: null } as any,
        sessionId: { in: sessionIds }
      },
      select: {
        id: true,
        content: true,
        embedding: true,
        sessionId: true,
        createdAt: true,
      },
    });

    const scored = messages
      .map((m) => {
        let parsed: number[] = [];
        try {
          parsed = JSON.parse(m.embedding as string);
        } catch (e) {}

        // Skip malformed/corrupted arrays seamlessly
        if (!Array.isArray(parsed) || parsed.length === 0) {
           return { ...m, score: 0 };
        }

        return {
          ...m,
          score: cosineSimilarity(queryEmbedding, parsed),
        };
      })
      .filter((m) => m.score > 0.70)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return NextResponse.json({ ok: true, results: scored });
  } catch (e: any) {
    console.error("SEARCH ERROR:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
