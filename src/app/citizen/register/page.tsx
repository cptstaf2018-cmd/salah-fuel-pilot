import Link from "next/link";
import { RegisterVehicleForm } from "./RegisterVehicleForm";

export default function CitizenRegisterPage() {
  return (
    <main className="public-page">
      <section className="public-hero">
        <Link className="back-link" href="/">
          العودة لغرفة العمليات
        </Link>
        <p className="eyebrow">منظومة وقود صلاح الدين الذكية</p>
        <h1>تسجيل مركبة المواطن</h1>
        <p>
          أدخل بيانات المركبة الأساسية لإصدار معرف داخلي ورمز QR آمن. لا يتم تخصيص محطة أو موعد إلا بعد تفعيل قواعد الأزمة من غرفة العمليات.
        </p>
      </section>
      <RegisterVehicleForm />
    </main>
  );
}
