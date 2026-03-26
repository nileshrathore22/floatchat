const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ include: { sessions: true } });
  console.log("---- SQLite DB USERS & SESSIONS ----");
  for (const u of users) {
    console.log(`Email: ${u.email || "NO-EMAIL"} | UID: ${u.firebaseUid} | Total Chats: ${u.sessions.length}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
