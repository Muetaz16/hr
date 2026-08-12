-- Add signature column to User (stores drawn signature as a PNG data URL)
ALTER TABLE "User" ADD COLUMN "signature" TEXT;
