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
        <p>أدخل بيانات المركبة مرة واحدة لإصدار رمز QR آمن. عند فتح الصفحة من الهاتف المسجل سيظهر QR مباشرة دون تكرار التسجيل.</p>
      </section>
      <RegisterVehicleForm />
    </main>
  );
}
