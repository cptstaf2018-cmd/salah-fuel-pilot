import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api";
import { maskPhone } from "@/lib/format";
import { verifyQrSchema } from "@/lib/validation/vehicles";
import { verifyVehicleQr } from "@/lib/vehicles";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission(request, "dispensing:verify");

  if (auth.response) {
    return auth.response;
  }

  const body = verifyQrSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "رمز QR غير صالح." }, { status: 400 });
  }

  const vehicle = await verifyVehicleQr(body.data.qrPayload);

  if (!vehicle) {
    return NextResponse.json({ error: "لم يتم العثور على مركبة صالحة لهذا الرمز." }, { status: 404 });
  }

  return NextResponse.json({
    vehicle: {
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      plateGovernorate: vehicle.plateGovernorate,
      plateCategory: vehicle.plateCategory,
      vehicleType: vehicle.vehicleType,
      registrationStatus: vehicle.registrationStatus,
      fuelType: vehicle.fuelType.nameAr,
      owner: {
        fullName: vehicle.owner.fullName,
        phone: maskPhone(vehicle.owner.phone)
      }
    }
  });
}
