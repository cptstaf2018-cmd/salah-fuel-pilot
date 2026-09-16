import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const vehicleId = String(form.get("vehicleId") || "");
  const front = form.get("front") as File | null;
  const back = form.get("back") as File | null;
  if (!vehicleId || !front || !back || front.size === 0 || back.size === 0) return NextResponse.json({ error: "الصورتان الأمامية والخلفية مطلوبة." }, { status: 400 });
  const validImage = async (file: File) => {
    if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(file.type)) return false;
    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    return jpeg || png;
  };
  if (!(await validImage(front)) || !(await validImage(back))) return NextResponse.json({ error: "ارفع صور JPG أو PNG واضحة للبطاقة الوطنية فقط، بحجم أقل من 5MB." }, { status: 400 });
  const ocrKey = process.env.OCR_SPACE_API_KEY;
  if (ocrKey) {
    const readCard = async (file: File) => { const body = new FormData(); body.append("file", file); body.append("apikey", ocrKey); body.append("language", "ara"); body.append("isOverlayRequired", "false"); const response = await fetch("https://api.ocr.space/parse/image", { method: "POST", body }); if (!response.ok) return ""; const data = await response.json() as { ParsedResults?: Array<{ ParsedText?: string }> }; return data.ParsedResults?.map((item) => item.ParsedText || "").join(" ") || ""; };
    const text = `${await readCard(front)} ${await readCard(back)}`.replace(/\s+/g, "");
    if (!text.includes("صلاحالدين") && !text.includes("صلاحالدین")) return NextResponse.json({ error: "لم نتعرف على بطاقة وطنية لمحافظة صلاح الدين. ارفع صورة واضحة للبطاقة." }, { status: 422 });
  }
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
