-- Add geocoded coordinates so real distances can be calculated.
-- Idempotent: init migration already includes these columns on fresh installs.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "pickupLat" DOUBLE PRECISION;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "pickupLon" DOUBLE PRECISION;

ALTER TABLE "Workshop" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Workshop" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
