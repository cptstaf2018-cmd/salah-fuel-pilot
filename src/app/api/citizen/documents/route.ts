import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const vehicleId = String(form.get("vehicleId") || "");
  const front = form.get("front") as File | null;
  const back = form.get("back") as File | null;
  if (!vehicleId || !front || !back || front.size === 0 || back.size === 0) return NextResponse.json({ error: "الصورتان الأمامية والخلفية مطلوبة." }, { status: 400 });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "إعدادات التخزين غير مكتملة." }, { status: 500 });
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return NextResponse.json({ error: "المركبة غير موجودة." }, { status: 404 });
  const base = `${url}/storage/v1/object/national-id-documents/${vehicleId}`;
  const upload = async (file: File, name: string) => fetch(`${base}/${name}`, { method: "POST", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" }, body: Buffer.from(await file.arrayBuffer()) });
  const [frontResult, backResult] = await Promise.all([upload(front, "front"), upload(back, "back")]);
  if (!frontResult.ok || !backResult.ok) return NextResponse.json({ error: "تعذر حفظ صور البطاقة." }, { status: 502 });
  await prisma.$executeRaw`insert into public.national_id_documents (vehicle_id, front_path, back_path) values (${vehicleId}::uuid, ${`${vehicleId}/front`}, ${`${vehicleId}/back`})`;
  return NextResponse.json({ status: "PENDING" }, { status: 201 });
}
