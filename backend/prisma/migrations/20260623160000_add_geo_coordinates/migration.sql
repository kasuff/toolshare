-- Add geocoded coordinates so real distances can be calculated.
ALTER TABLE "User" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN "longitude" DOUBLE PRECISION;

ALTER TABLE "Tool" ADD COLUMN "pickupLat" DOUBLE PRECISION;
ALTER TABLE "Tool" ADD COLUMN "pickupLon" DOUBLE PRECISION;

ALTER TABLE "Workshop" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Workshop" ADD COLUMN "longitude" DOUBLE PRECISION;
