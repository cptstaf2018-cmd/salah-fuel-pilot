import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api";
import { assignVehicleToCrisisRule } from "@/lib/allocation";
import { assignVehicleSchema } from "@/lib/validation/crisis";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission(request, "crisis:manage");

  if (auth.response) {
    return auth.response;
  }

  const body = assignVehicleSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "بيانات التخصيص غير صحيحة." }, { status: 400 });
  }

  try {
    const result = await assignVehicleToCrisisRule({
      ...body.data,
      actorUserId: auth.user.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent")
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر تخصيص المركبة." },
      { status: 400 }
    );
  }
}
