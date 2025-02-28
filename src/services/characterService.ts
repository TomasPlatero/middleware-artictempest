import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getCharactersByUser(userId: number) {
  return await prisma.character.findMany({
    where: { userId },
  });
}

export async function addCharacter(userId: number, name: string, realm: string, region: string, className: string, ilvl: number, mythicScore: number, updatedAt: Date) {
  return await prisma.character.create({
    data: {
      userId,
      name,
      realm,
      region,
      class: className,
      ilvl,
      mythicScore,
      updatedAt,
    },
  });
}

export async function syncCharacters(userId: number, characters: any[]) {
  const characterData = characters.map((char) => ({
    userId,
    name: char.name,
    realm: char.realm,
    region: char.region,
    class: char.class,
    ilvl: char.ilvl,
    mythicScore: char.mythicScore || 0,
    updatedAt: new Date()
  }));

  return await prisma.character.createMany({
    data: characterData,
    skipDuplicates: true, // Evita duplicados
  });
}
