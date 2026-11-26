ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "device_password_encrypted" text;
ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "device_password_hint" varchar(120);
