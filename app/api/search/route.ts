import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

// Cleaned up semantic search utilities internally in favor of absolute lexical matching

export async function POST(req: Request) {
  try {
    const decoded = await requireAuth(req);
    const { query } = await req.json().catch(() => ({}));

    if (!query) {
      return NextResponse.json({ ok: true, results: [] });
    }



    // First, translate the Firebase UID to the internal database SQLite CUID
    const dbUser = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true }
    });

    if (!dbUser) {
      return NextResponse.json({ ok: true, results: [] });
    }

    // Isolate Search exclusively to this user's sessions to prevent data leakage
    const userSessions = await prisma.chatSession.findMany({
      where: { userId: dbUser.id },
      select: { id: true }
    });
    const sessionIds = userSessions.map(s => s.id);

    // Fetch ALL metadata for the user's sessions to run a lightning-fast memory filter
    const messages = await prisma.message.findMany({
      where: { 
        sessionId: { in: sessionIds }
      },
      select: {
        id: true,
        content: true,
        sessionId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    const loweredQuery = query.toLowerCase().trim();

    // Execute case-insensitive lexical substring matching
    const scored = messages
      .filter((m) => m.content.toLowerCase().includes(loweredQuery))
      .map((m) => ({
        ...m,
        score: 1.0, // Hardcoded 100% Match for the UI
      }))
      .slice(0, 15);

    return NextResponse.json({ ok: true, results: scored });
  } catch (e: any) {
    console.error("SEARCH ERROR:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
