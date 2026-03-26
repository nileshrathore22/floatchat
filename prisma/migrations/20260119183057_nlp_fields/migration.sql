-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "summary" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "intent" TEXT,
ADD COLUMN     "keywords" TEXT,
ADD COLUMN     "sentiment" TEXT;
