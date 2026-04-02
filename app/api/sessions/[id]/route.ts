import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await requireAuth(req);
    const { id: sessionId } = await params;
    
    // Delete all child messages first to prevent Foreign Key constraint errors (No onDelete: Cascade)
    await prisma.message.deleteMany({
      where: { sessionId }
    });

    // Delete the session safely enforcing user ownership
    await prisma.chatSession.delete({
      where: { 
        id: sessionId,
        userId: decoded.uid
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error deleting session:", error);
    return NextResponse.json({ ok: false, error: "Deletion failed" }, { status: 500 });
  }
}
