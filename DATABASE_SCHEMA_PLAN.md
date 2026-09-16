# خطة قاعدة البيانات

## المبادئ

- PostgreSQL فقط للإنتاج.
- UUID لكل الكيانات الأساسية.
- `created_at` و `updated_at` حيث يلزم.
- Foreign keys و unique constraints و indexes للحقول المستخدمة في البحث والعلاقات.
- Inventory Ledger بدلا من تعديل رقم المخزون مباشرة.
- العمليات الحرجة مثل تجهيز الوقود وتحديث المخزون تتم داخل database transaction.

## جداول PHASE 1

- `users`: الحسابات، الدور، كلمة المرور المشفرة، حالة الحساب، آخر دخول.
- `sessions`: جلسات موقعة قابلة للإلغاء.
- `governorates`: المحافظة المستهدفة.
- `districts`: الأقضية والمناطق.
- `stations`: أساس المحطات دون بيانات وهمية في الإنتاج.
- `audit_logs`: سجل تدقيق غير قابل للتعديل من واجهة المستخدم.
- `system_settings`: إعدادات عامة مثل وضع التشغيل و Pilot.

## الجداول المخططة للمراحل التالية

### PHASE 2

- `station_users`: ربط المستخدمين بالمحطات التي يحق لهم العمل عليها.
- `fuel_types`: تعريف أنواع الوقود.
- `fuel_inventory`: الرصيد الحالي لكل محطة ولكل نوع وقود.
- `inventory_transactions`: دفتر حركة المخزون الكامل.

### PHASE 3 وما بعدها

### PHASE 3

- `vehicle_owners`: بيانات مالك المركبة الأساسية مع رقم هاتف فريد.
- `vehicles`: بيانات المركبة، نوع الوقود، وصيغة لوحة مرنة عبر `plate_metadata`.
- `vehicle_qr_tokens`: توكنات QR مخزنة كـ hash فقط مع `public_id`.

### PHASE 4 وما بعدها

### PHASE 4

- `crisis_rules`: قواعد الأزمة، الحصة، مدة منع التكرار، أنواع المركبات، وبداية/نهاية القرار.
- `crisis_rule_stations`: المحطات المشمولة في القاعدة.
- `time_slots`: المواعيد والسعة والحجوزات الحالية.
- `allocations`: قرار تخصيص المركبة للمحطة والموعد.
- `appointments`: موعد تجهيز المركبة وحالة الموعد.

### PHASE 5 وما بعدها

- `fuel_dispensing_transactions`
- `tankers`
- `tanker_shipments`
- `tanker_locations`
- `notifications`
- `anpr_events`

## قيود مهمة

- `users.email` فريد عند توفره.
- `users.phone` فريد عند توفره.
- `stations.code` فريد.
- `fuel_types.code` فريد.
- `fuel_inventory.station_id + fuel_type_id` فريد.
- `station_users.station_id + user_id` فريد.
- `sessions.token_hash` فريد ولا يخزن التوكن الخام.
- `audit_logs` يحتوي على actor و action و resource و metadata و ip و user agent.

## Migrations

- يتم توليد migration حقيقية عبر Prisma عند توفر PostgreSQL.
- في التطوير يمكن استخدام `docker compose up -d db`.
- لا يتم وضع بيانات حكومية وهمية في migration.
