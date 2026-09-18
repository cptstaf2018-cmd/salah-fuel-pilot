export type DashboardStation = {
  id: string;
  code: string;
  nameAr: string;
  status: string;
  fuelInventory: {
    fuelTypeId: string;
    quantityLiters: string;
    minimumThresholdLiters: string;
    fuelType: { nameAr: string };
  }[];
};

export type DashboardVehicle = {
  id: string;
  plateNumber: string;
  owner: { fullName: string };
  fuelType: { nameAr: string };
  registrationStatus: string;
};

export type DashboardCrisisRule = {
  id: string;
  name: string;
  status: string;
  quotaLiters: string;
  cooldownHours: number;
  vehiclesPerStationPerHour: number;
  startsAt: string;
  endsAt: string;
  fuelType: { nameAr: string };
  _count: { stations: number; allocations: number };
};

export type DashboardGovernorate = {
  id: string;
  nameAr: string;
  districts: { id: string; nameAr: string }[];
};

export type DashboardFuelType = {
  id: string;
  code: string;
  nameAr: string;
};

export type Dashboard = {
  user: { name: string; role: string };
  stations: DashboardStation[];
  transactions: {
    id: string;
    createdAt: string;
    type: string;
    station: { nameAr: string };
    fuelType: { nameAr: string };
    quantityChange: string;
    quantityAfter: string;
    reason: string;
    actor: { name: string };
  }[];
  vehicles: DashboardVehicle[];
  vehiclesPage: { page: number; pageSize: number; total: number; totalPages: number };
  vehicleSummary: {
    byFuel: { fuelTypeId: string; fuelName: string; count: number }[];
    byStatus: { status: string; count: number }[];
  };
  logs: {
    id: string;
    action: string;
    createdAt: string;
    outcome: string;
    actor: { name: string } | null;
  }[];
  crisisRules: DashboardCrisisRule[];
  governorates: DashboardGovernorate[];
  fuelTypes: DashboardFuelType[];
  dispensedToday: { liters: number; count: number };
};

export const vehicleTypeLabels: Record<string, string> = {
  PRIVATE_CAR: "سيارة خصوصي",
  TAXI: "أجرة",
  BUS: "باص",
  TRUCK: "شاحنة",
  MOTORCYCLE: "دراجة",
  GOVERNMENT: "حكومية",
  OTHER: "أخرى"
};

export const registrationLabels: Record<string, { label: string; state: "ok" | "warn" | "critical" | "idle" }> = {
  PENDING_ALLOCATION: { label: "بانتظار التخصيص", state: "warn" },
  ACTIVE: { label: "مخصصة", state: "ok" },
  SUSPENDED: { label: "موقوفة", state: "critical" },
  REJECTED: { label: "مرفوضة", state: "critical" }
};

export const auditLabels: Record<string, string> = {
  AUTH_LOGIN_SUCCEEDED: "دخول ناجح",
  AUTH_LOGIN_FAILED: "محاولة دخول فاشلة",
  PILOT_FUEL_RECEIVED: "استلام وقود",
  ALLOCATION_CREATED: "تخصيص حصة",
  DISPENSING_CONFIRMED: "صرف وقود",
  DISPENSING_REJECTED: "رفض صرف",
  CRISIS_RULE_CREATED: "إنشاء قاعدة أزمة",
  CRISIS_MODE_CHANGED: "تغيير وضع الأزمة",
  STATION_UPDATED: "تعديل محطة",
  STATION_CLOSED: "إغلاق محطة",
  STATION_DELETED: "حذف محطة",
  VEHICLE_REGISTERED: "تسجيل مركبة",
  VEHICLE_UPDATED: "تعديل مركبة",
  VEHICLE_SUSPENDED: "إيقاف مركبة",
  VEHICLE_DELETED: "حذف مركبة",
  MANUAL_INVENTORY_ADJUSTMENT: "تعديل مخزون يدوي",
  NATIONAL_ID_UPLOADED: "رفع بطاقة وطنية",
  PERMISSION_DENIED: "رفض صلاحية"
};
