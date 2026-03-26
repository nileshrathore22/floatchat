-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "emotion" TEXT,
ADD COLUMN     "emotionScore" DOUBLE PRECISION,
ADD COLUMN     "sentimentScore" DOUBLE PRECISION,
ADD COLUMN     "topic" TEXT,
ADD COLUMN     "toxicity" DOUBLE PRECISION;
