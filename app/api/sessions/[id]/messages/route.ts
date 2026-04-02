import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { prisma } from "@/lib/prisma";
import { analyzeWithML } from "@/lib/nlpClient";
import { getEmbedding } from "@/lib/embeddingClient";
import { summarizeMessages } from "@/lib/summaryClient";


export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await requireAuth(req);
    const { id: sessionId } = await context.params;

    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: { id: true },
    });

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        sentiment: true,
        intent: true,
        keywords: true,
        smartReplies: true,
      },
    });

    // Parse smartReplies from string back to array for UI
    const parsedMessages = messages.map(m => ({
      ...m,
      smartReplies: m.smartReplies ? JSON.parse(m.smartReplies as any) : []
    }));

    return NextResponse.json({ ok: true, messages: parsedMessages });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 401 });
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await requireAuth(req);
    const { id: sessionId } = await context.params;

    const body = await req.json();
    const content = String(body.content ?? "").trim();
    const imageUrl = body.imageUrl ?? null;

    if (!content && !imageUrl) {
      return NextResponse.json(
        { ok: false, error: "Empty message" },
        { status: 400 }
      );
    }

    // 🔹 Fetch Session Session Summary
    const sessionData = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { summary: true },
    });

    // 🔹 Load history (current user message is not in DB yet)
    const history = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: { role: true, content: true },
    });
    const cleanedHistory = history;

    // 🔹 Semantic Recall (Simplified for SQLite)
    let similarMessages: { role: string; content: string }[] = [];

    // 🔹 Call FastAPI Immediately
    const aiRes = await fetch(`${process.env.NLP_SERVICE_URL || "http://127.0.0.1:8000"}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: content,
        history: cleanedHistory,
        summary: sessionData?.summary ?? null,
        recalled: similarMessages,
        intent: "general", // We run true intent analysis async
        imageUrl,
      }),
    });

    if (!aiRes.body) throw new Error("No AI response body");

    const reader = aiRes.body.getReader();
    const decoder = new TextDecoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    let fullResponse = "";

    // 🔹 Background Task: Analysis and Stream Copying
    (async () => {
      // 1. Heavy ML Processing in background
      const [analysisResult, embeddingResult] = await Promise.all([
        analyzeWithML(content).catch(() => ({
          sentiment: "neutral",
          intent: "general",
          keywords: [],
          smart_replies: [],
        })),
        getEmbedding(content).catch(() => null),
      ]);
      const analysis = analysisResult;
      const embedding = embeddingResult;

      // 2. Save User Message
      await prisma.message.create({
        data: {
          role: "user",
          content,
          imageUrl,
          sentiment: analysis.sentiment ?? null,
          intent: analysis.intent ?? null,
          keywords: analysis.keywords?.join(", ") ?? null,
          embedding: (embedding ? JSON.stringify(embedding) : null) as any,
          session: { connect: { id: sessionId } },
        },
      });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullResponse += chunk;
        await writer.write(encoder.encode(chunk));
      }
      await writer.close();

      // 🔹 Evaluation (Hallucination & Confidence)
      let hallucinationScore = 0;
      try {
        const checkRes = await fetch(`${process.env.NLP_SERVICE_URL || "http://127.0.0.1:8000"}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Rate hallucination risk from 0 to 1 for this answer:\n${fullResponse}`,
            history: [],
            summary: null,
            recalled: [],
            intent: "evaluation",
          }),
        });
        if (checkRes.ok) {
          const data = await checkRes.json();
          const rawScore = String(data.response || "0");
          hallucinationScore = parseFloat(rawScore) || 0;
        }
      } catch {}

      let confidence = 1.0;
      if (analysis.intent === "question" && hallucinationScore > 0.6) confidence = 0.4;
      else if (hallucinationScore > 0.4) confidence = 0.7;

      // 🔹 Save assistant message
      await prisma.message.create({
        data: {
          role: "assistant",
          content: fullResponse,
          sentiment: analysis.sentiment ?? null,
          intent: analysis.intent ?? null,
          keywords: analysis.keywords?.join(", ") ?? null,
          smartReplies: JSON.stringify(analysis.smart_replies ?? []) as any,
          embedding: null as any,
          confidence,
          session: { connect: { id: sessionId } },
        },
      });

      // 🔹 Auto title & Summary logic...
      const messageCount = await prisma.message.count({ where: { sessionId } });
      if (messageCount === 2) {
        try {
          const titleRes = await fetch(`${process.env.NLP_SERVICE_URL || "http://127.0.0.1:8000"}/generate-title`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: content }),
          });
          if (titleRes.ok) {
            const { title } = await titleRes.json();
            await prisma.chatSession.update({ where: { id: sessionId }, data: { title } });
          }
        } catch {}
      }

      const allMessages = await prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      });
      if (allMessages.length >= 6) {
        try {
          const summaryRes = await fetch(`${process.env.NLP_SERVICE_URL || "http://127.0.0.1:8000"}/summarize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts: allMessages.map(m => `${m.role}: ${m.content}`) }),
          });
          if (summaryRes.ok) {
            const { summary } = await summaryRes.json();
            await prisma.chatSession.update({ where: { id: sessionId }, data: { summary } });
          }
        } catch {}
      }
    })();

    // 🔹 Return stream immediately without waiting for analysis
    return new Response(stream.readable, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (e: any) {
    console.error("POST ERROR:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
