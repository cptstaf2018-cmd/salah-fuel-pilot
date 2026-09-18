import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiPermission } from "@/lib/api";
import { autoAllocatePendingVehicles, createCrisisRule } from "@/lib/allocation";
import { prisma } from "@/lib/prisma";
import { createCrisisRuleSchema } from "@/lib/validation/crisis";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission(request, "governorate:read");

  if (auth.response) {
    return auth.response;
  }

  const rules = await prisma.crisisRule.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      fuelType: true,
      stations: {
        include: { station: true }
      }
    }
  });

  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission(request, "crisis:manage");

  if (auth.response) {
    return auth.response;
  }

  const body = createCrisisRuleSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "بيانات قاعدة الأزمة غير صحيحة." }, { status: 400 });
  }

  try {
    const rule = await createCrisisRule({
      ...body.data,
      eligibilityRules: body.data.eligibilityRules as Prisma.InputJsonObject | undefined,
      actorUserId: auth.user.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent")
    });

    // A rule exists to distribute fuel, so distribution starts with it. Leaving
    // it to a separate button meant an officer activated a crisis, saw nothing
    // allocated, and had no way to tell whether the rule had worked.
    const allocation = await autoAllocatePendingVehicles({
      fuelTypeId: body.data.fuelTypeId,
      actorUserId: auth.user.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent")
    });

    return NextResponse.json({ rule, allocation }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر إنشاء قاعدة الأزمة." },
      { status: 400 }
    );
  }
}
