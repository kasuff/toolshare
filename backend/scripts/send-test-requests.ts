/**
 * Legt Test-Ausleihanfragen in der DB an (Inbox + Glocke für den Werkzeug-Besitzer).
 * Nutzung: cd backend && npx ts-node --transpile-only scripts/send-test-requests.ts
 *
 * Voraussetzung: Nutzer mit Ziel-E-Mail existiert bereits (Registrierung in der App).
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const TARGET_EMAIL = "unglertmaik@gmail.com";
const REQUEST_COUNT = 3;
/** Buchungszeitraum erst ab diesem Tag (nach 02.07., hier 03.07.2026 UTC). */
const BOOKING_START_AFTER = new Date(Date.UTC(2026, 6, 3, 12, 0, 0));

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: { tools: true },
  });

  if (!owner) {
    console.error(`Kein Nutzer mit ${TARGET_EMAIL} in der Datenbank. Bitte zuerst in der App registrieren.`);
    process.exit(1);
  }

  let tool = owner.tools[0];
  if (!tool) {
    tool = await prisma.tool.create({
      data: {
        ownerId: owner.id,
        name: "Test-Werkzeug (Auto-Script)",
        description: "Von scripts/send-test-requests.ts angelegt.",
        category: "Sonstiges",
        status: "AVAILABLE",
      },
    });
    console.log("Hilfswerkzeug angelegt:", tool.id);
  }

  const stamp = Date.now();
  const reqEmail = `test-anfrage-${stamp}@toolshare.local`;
  const passwordHash = await bcrypt.hash(`TestPass-${stamp}!`, 10);
  const requester = await prisma.user.create({
    data: {
      email: reqEmail,
      passwordHash,
      name: "Test-Anfragender",
      address: "Musterstraße 1, 80331 München, Deutschland",
    },
  });

  for (let i = 0; i < REQUEST_COUNT; i++) {
    const start = new Date(BOOKING_START_AFTER.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
    const pickup = new Date(start.getTime());
    pickup.setUTCHours(9, 0, 0, 0);

    await prisma.booking.create({
      data: {
        userId: requester.id,
        toolId: tool.id,
        status: "PENDING",
        startDate: start,
        endDate: end,
        pickupTime: pickup,
      },
    });

    await prisma.notification.create({
      data: {
        userId: owner.id,
        message: `Neue Ausleihanfrage fuer dein Werkzeug. (Test ${i + 1}/${REQUEST_COUNT})`,
        read: false,
      },
    });
  }

  console.log(
    `OK: ${REQUEST_COUNT} Test-Anfragen für ${TARGET_EMAIL} erstellt (Anfragender: ${reqEmail}, Tool: ${tool.name}).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
