import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api";
import { createCrisisRule } from "@/lib/allocation";
import { prisma } from "@/lib/prisma";

const defaults = {
  quotaLiters: 20,
  cooldownHours: 48,
  vehiclesPerStationPerHour: 30,
  durationDays: 7,
  includedVehicleTypes: ["PRIVATE_CAR", "TAXI", "BUS", "TRUCK", "MOTORCYCLE", "GOVERNMENT", "OTHER"] as const
};

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission(request, "crisis:manage");
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({})) as { ruleId?: string };
  const now = new Date();

  if (body.ruleId) {
    const rule = await prisma.crisisRule.update({ where: { id: body.ruleId }, data: { status: "ACTIVE", startsAt: now } });
    return NextResponse.json({ rules: [rule], created: 0 });
  }

  const [stations, fuelTypes] = await Promise.all([
    prisma.station.findMany({ select: { id: true } }),
    prisma.fuelType.findMany({ where: { isActive: true }, select: { id: true, nameAr: true } })
  ]);
  if (!stations.length) return NextResponse.json({ error: "لا توجد محطات مسجلة لتفعيل الأزمة عليها." }, { status: 400 });
  if (!fuelTypes.length) return NextResponse.json({ error: "لا توجد أنواع وقود مفعّلة." }, { status: 400 });

  const rules = [];
  let created = 0;
  for (const fuelType of fuelTypes) {
    // A rule only allocates while its window covers now and it still has unused future slots.
    const usable = await prisma.crisisRule.findFirst({
      where: {
        fuelTypeId: fuelType.id,
        status: "ACTIVE",
        startsAt: { lte: now },
        endsAt: { gte: now },
        timeSlots: { some: { startsAt: { gte: now } } }
      },
      orderBy: { createdAt: "desc" }
    });
    if (usable) {
      rules.push(usable);
      continue;
    }
    rules.push(await createCrisisRule({
      name: `أزمة ${fuelType.nameAr} · ${now.toLocaleDateString("ar-IQ")}`,
      fuelTypeId: fuelType.id,
      stationIds: stations.map((station) => station.id),
      quotaLiters: defaults.quotaLiters,
      cooldownHours: defaults.cooldownHours,
      vehiclesPerStationPerHour: defaults.vehiclesPerStationPerHour,
      includedVehicleTypes: [...defaults.includedVehicleTypes],
      startsAt: now,
      endsAt: new Date(now.getTime() + defaults.durationDays * 24 * 60 * 60 * 1000),
      actorUserId: auth.user.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent")
    }));
    created += 1;
  }

  return NextResponse.json({ rules, created });
}
