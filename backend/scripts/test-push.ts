import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Expo } from "expo-server-sdk";

const prisma = new PrismaClient();
const expo = new Expo();

async function main() {
  const tokenArg = process.argv[2];
  const title = process.argv[3] ?? "ToolShare Test";
  const body = process.argv[4] ?? "Push-Test vom Backend";

  let pushToken: string | undefined = tokenArg;

  if (!pushToken) {
    const users = await prisma.user.findMany({
      where: { expoPushToken: { not: null } },
      select: { id: true, email: true, name: true, expoPushToken: true },
      take: 10
    });

    if (users.length === 0) {
      console.error("Keine User mit gespeichertem expoPushToken gefunden.");
      console.error("Usage: npx ts-node scripts/test-push.ts [ExponentPushToken[...]] [title] [body]");
      process.exit(1);
    }

    console.log("User mit Push-Token:");
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name}) -> ${user.expoPushToken}`);
    });

    pushToken = users[0].expoPushToken ?? undefined;
  }

  if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
    console.error("Ungültiger oder fehlender Expo Push Token:", pushToken);
    process.exit(1);
  }

  console.log(`Sende Test-Push an ${pushToken} ...`);

  const [ticket] = await expo.sendPushNotificationsAsync([
    {
      to: pushToken,
      sound: "default",
      title,
      body,
      channelId: "default"
    }
  ]);

  console.log("Ticket:", JSON.stringify(ticket, null, 2));

  if (ticket.status !== "ok") {
    process.exit(1);
  }

  console.log("Warte 15s auf Push-Receipt ...");
  await new Promise((resolve) => setTimeout(resolve, 15_000));

  const receipts = await expo.getPushNotificationReceiptsAsync([ticket.id]);
  console.log("Receipt:", JSON.stringify(receipts, null, 2));

  const receipt = receipts[ticket.id];
  if (receipt?.status === "error") {
    const errorCode = receipt.details?.error as string | undefined;
    if (errorCode === "InvalidCredentials" || errorCode === "MismatchSenderId") {
      console.error("\nFCM-Credentials fehlen oder passen nicht zum Firebase-Projekt.");
      console.error("Lösung: FCM V1 Service Account Key in EAS hochladen:");
      console.error("https://expo.dev/accounts/maik22/projects/toolshare/credentials");
    }
    process.exit(1);
  }

  console.log("\nPush wurde erfolgreich an Expo/FCM übergeben.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
