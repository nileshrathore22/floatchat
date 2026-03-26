import { adminAuth } from "./firebaseAdmin";

export async function requireAuth(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: missing Bearer token");

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return { uid: decodedToken.uid, email: decodedToken.email };
  } catch (error: any) {
    throw new Error(`Unauthorized: ${error?.message || "Invalid token"}`);
  }
}
