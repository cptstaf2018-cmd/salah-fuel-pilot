import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed data is development-only and must not run in production.");
  }

  await prisma.fuelType.upsert({
    where: { code: "DEV_GASOLINE" },
    create: {
      code: "DEV_GASOLINE",
      nameAr: "بنزين - بيانات تطوير",
      nameEn: "Gasoline - Development"
    },
    update: {}
  });

  await prisma.fuelType.upsert({
    where: { code: "DEV_DIESEL" },
    create: {
      code: "DEV_DIESEL",
      nameAr: "كاز - بيانات تطوير",
      nameEn: "Diesel - Development"
    },
    update: {}
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
