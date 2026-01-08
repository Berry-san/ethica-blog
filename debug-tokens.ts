
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = '15601b94-705f-45be-94b0-c9c546bc17b3';
  const tokens = await prisma.refreshToken.findMany({
    where: { userId },
  });
  console.log('Tokens found:', tokens);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
