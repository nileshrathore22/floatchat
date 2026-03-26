import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const decoded = await requireAuth(req);

    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const sessions = await prisma.chatSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, sessions });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const decoded = await requireAuth(req);
    const body = await req.json().catch(() => ({}));

    const title =
      typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New chat";

    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const session = await prisma.chatSession.create({
      data: { userId: user.id, title },
      select: { id: true, title: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, session });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 401 });
  }
}
