import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission(request, "crisis:manage");
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({})) as { ruleId?: string };
  const rule = body.ruleId
    ? await prisma.crisisRule.update({ where: { id: body.ruleId }, data: { status: "ACTIVE" } })
    : await prisma.crisisRule.findFirst({ where: { status: "DRAFT" }, orderBy: { createdAt: "desc" } });
  if (!rule) return NextResponse.json({ error: "لا توجد قاعدة أزمة جاهزة للتفعيل." }, { status: 404 });
  if (!body.ruleId) await prisma.crisisRule.update({ where: { id: rule.id }, data: { status: "ACTIVE" } });
  return NextResponse.json({ rule });
}
