-- The Promotions module's stage order was swapped (Notice of Promotion is now stage 1, Promotion
-- Report is now the final/closing stage) — every application code path already sets `stage`
-- explicitly on create, so this default is never actually exercised, but kept in sync with
-- schema.prisma for a clean `prisma migrate diff`.
ALTER TABLE "PromotionCase" ALTER COLUMN "stage" SET DEFAULT 'NOTICE_OF_PROMOTION';
