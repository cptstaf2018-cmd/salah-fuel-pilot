# خطة التنفيذ - منظومة وقود صلاح الدين الذكية

## الموجود فعليا

- يوجد ملف مواصفات واحد فقط: `محطة.py`.
- لا يوجد تطبيق، ولا قاعدة بيانات، ولا اختبارات، ولا إعدادات تشغيل.
- المسار المشار إليه لملف التعريف الشخصي غير موجود: `C:\Users\saad\Documents\Codex\Projects\about-me.md\AGENTS.md`.

## المعمارية المقترحة

- Frontend: Next.js App Router مع TypeScript وواجهة عربية RTL.
- Backend: Next.js Route Handlers للمرحلة الأولى، مع فصل منطق الأعمال في `src/lib`.
- Database: PostgreSQL عبر Prisma.
- Auth: جلسات موقعة في HttpOnly cookies، كلمات مرور Argon2id، وسياسة انتهاء جلسات.
- Authorization: RBAC مركزي في `src/lib/rbac.ts`.
- Audit: جدول `audit_logs` وخدمة موحدة لتسجيل الإجراءات الحساسة.
- Deployment readiness: Docker Compose للتطوير، وملفات `.env.example` بدون أسرار.

## تقسيم المراحل

### PHASE 1 - Foundation

الهدف: تأسيس مشروع قابل للبناء والاختبار.

- إنشاء تطبيق Next.js + TypeScript.
- تصميم Prisma schema الأساسي.
- تعريف الأدوار والصلاحيات.
- بناء APIs أولية للمصادقة والحالة.
- بناء Audit Log service.
- إنشاء Design System أولي RTL.
- اختبارات RBAC، كلمات المرور، الجلسات.
- تحقق: `npm test` و `npm run build`.

### PHASE 2 - Stations and Inventory

- إدارة المحطات.
- أنواع الوقود.
- Inventory Ledger.
- منع تعديل المخزون كرقم مباشر.
- اختبارات صلاحيات وحركات مخزون.

حالة التنفيذ: مكتمل. تمت إضافة جداول المحطات والمستخدمين المرتبطين بها، أنواع الوقود، مخزون الوقود، ودفتر حركات المخزون مع APIs واختبارات.

### PHASE 3 - Citizen, Vehicles, QR

- تسجيل المواطن والمركبة.
- Vehicle ID داخلي.
- QR token آمن.
- واجهة المواطن PWA.

حالة التنفيذ: مكتمل. تمت إضافة مالكي المركبات، المركبات، وتوكنات QR آمنة لا تحتوي بيانات حساسة، مع APIs واختبارات.

### PHASE 4 - Crisis Mode and Allocation

- قواعد الأزمة القابلة للتعديل.
- Allocation Engine.
- Time slots ومنع Overbooking.

حالة التنفيذ: مكتمل. تمت إضافة قواعد أزمة قابلة للتعديل، توليد مواعيد بالساعة، وتخصيص مركبة إلى محطة وموعد دون تجاوز السعة.

### PHASE 5 - Station Dispensing

- فحص QR أو رقم اللوحة.
- Transaction آمنة للتجهيز.
- منع التكرار وسباقات الموظفين.

### PHASE 6 - Governorate Command Center

- Dashboard المحافظة.
- الخريطة.
- التقارير والتنبيهات.

### PHASE 7 - Distribution and Tankers

- الشحنات.
- حالات الصهاريج.
- مقارنة الكميات والتنبيهات.

### PHASE 8 - Notifications

- Notification service abstraction.
- SMS / WhatsApp / In-App adapters.

### PHASE 9 - GPS and ANPR Integration Layer

- API للصهاريج والمواقع.
- API لأحداث ANPR بدون صرف تلقائي.

### PHASE 10 - Pilot Dashboard

- Pilot mode لمدة 30 يوما من تاريخ التفعيل.
- Pilot Results.
- Pilot Evaluation Report.

## ما ينقص مقارنة بالمواصفات

- كل مكونات النظام التنفيذية كانت غير موجودة قبل هذه المرحلة.
- لا توجد قاعدة بيانات أو migrations.
- لا توجد Auth/RBAC/Audit.
- لا توجد واجهات أو APIs.
- لا توجد اختبارات.
- لا توجد وثائق تشغيل أو استعادة أو مراقبة.

## قاعدة الانتقال بين المراحل

لا يتم الانتقال إلى المرحلة التالية إلا بعد:

- نجاح الاختبارات.
- نجاح البناء.
- إصلاح أخطاء TypeScript.
- توثيق ما تم وما بقي.
