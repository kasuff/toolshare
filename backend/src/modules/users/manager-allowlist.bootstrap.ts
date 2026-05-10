import { prisma } from "../../config/prisma";
import { env } from "../../config/env";

export const bootstrapManagerAllowlist = async () => {
  if (env.managerEmailAllowlist.length === 0) {
    return;
  }

  const allowlistFilter = env.managerEmailAllowlist.map((email) => ({
    email: { equals: email, mode: "insensitive" as const }
  }));

  const allowlistedUsers = await prisma.user.findMany({
    where: { OR: allowlistFilter },
    select: {
      id: true,
      email: true,
      role: true
    }
  });

  const userIdsToPromote = allowlistedUsers
    .filter((user) => user.role !== "MANAGER")
    .map((user) => user.id);

  if (userIdsToPromote.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: userIdsToPromote } },
      data: { role: "MANAGER" }
    });
  }

  const foundEmails = new Set(allowlistedUsers.map((user) => user.email.toLowerCase()));
  const missingEmails = env.managerEmailAllowlist.filter((email) => !foundEmails.has(email));

  if (missingEmails.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `Manager allowlist contains emails that are not registered yet: ${missingEmails.join(", ")}`
    );
  }
};