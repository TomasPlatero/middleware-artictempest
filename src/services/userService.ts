import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createUser(discordId: string, battleNetId: number, username: string) {
  return await prisma.user.upsert({
    where: { discordId },
    update: { battleNetId, username },
    create: { discordId, battleNetId, username },
  });
}
