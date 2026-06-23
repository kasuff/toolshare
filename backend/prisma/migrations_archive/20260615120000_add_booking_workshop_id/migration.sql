-- AlterTable: Werkstattbuchungen referenzieren die Werkstatt jetzt direkt (statt nur über einen Zeitslot).
ALTER TABLE "Booking" ADD COLUMN "workshopId" TEXT;

-- CreateIndex
CREATE INDEX "Booking_workshopId_startDate_endDate_idx" ON "Booking"("workshopId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
