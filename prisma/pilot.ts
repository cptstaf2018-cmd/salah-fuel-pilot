import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();
async function main() {
  const password = process.env.PILOT_PASSWORD;
  if (!password || password.length < 12) throw new Error("PILOT_PASSWORD is required (12+ characters)");
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const admin = await tx.user.upsert({ where: { email: "admin@pilot.local" }, update: {}, create: { email: "admin@pilot.local", name: "مدير التجربة", role: "SUPER_ADMIN", passwordHash } });
    const gov = await tx.governorate.findFirst({ where: { nameAr: "صلاح الدين" } }) ?? await tx.governorate.create({ data: { nameAr: "صلاح الدين", nameEn: "Salah Al-Din" } });
    const fuels = await Promise.all([["PILOT_GASOLINE", "بنزين"], ["PILOT_DIESEL", "كاز"]].map(([code, nameAr]) => tx.fuelType.upsert({ where: { code }, update: {}, create: { code, nameAr } })));
    for (const [index, nameAr] of ["تكريت الداخل", "القادسية", "العوجة"].entries()) {
      const station = await tx.station.upsert({ where: { code: `PILOT-${index + 1}` }, update: {}, create: { code: `PILOT-${index + 1}`, nameAr, governorateId: gov.id, status: "NORMAL" } });
      const manager = await tx.user.upsert({ where: { email: `station${index + 1}@pilot.local` }, update: {}, create: { email: `station${index + 1}@pilot.local`, name: `صاحب محطة ${nameAr}`, role: "STATION_MANAGER", passwordHash } });
      await tx.stationUser.upsert({ where: { stationId_userId: { stationId: station.id, userId: manager.id } }, update: {}, create: { stationId: station.id, userId: manager.id } });
      for (const [fuelIndex, fuel] of fuels.entries()) {
        const existing = await tx.fuelInventory.findUnique({ where: { stationId_fuelTypeId: { stationId: station.id, fuelTypeId: fuel.id } } });
        if (existing) continue;
        const quantity = fuelIndex === 0 ? 80000 : 50000;
        const inventory = await tx.fuelInventory.create({ data: { stationId: station.id, fuelTypeId: fuel.id, quantityLiters: quantity } });
        await tx.inventoryTransaction.create({ data: { stationId: station.id, fuelTypeId: fuel.id, inventoryId: inventory.id, actorUserId: admin.id, type: "TANKER_RECEIPT", quantityBefore: 0, quantityChange: quantity, quantityAfter: quantity, reason: "الحصة الافتتاحية للتجربة" } });
      }
    }
  }, { timeout: 30000 });
  console.log("Pilot stations and accounts ready; existing balances preserved.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
