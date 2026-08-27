-- Removes the unused AssetRequest, StaffTask, and SupportTicket features entirely — all three
-- had a fully-built backend with no working frontend. Neither is referenced by any other
-- table's foreign key, so a plain DROP (no CASCADE) is enough once each table's own
-- constraints go with it.
DROP TABLE IF EXISTS "AssetRequest";
DROP TABLE IF EXISTS "StaffTask";
DROP TABLE IF EXISTS "SupportTicket";
