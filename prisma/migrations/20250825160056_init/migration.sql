-- CreateEnum
CREATE TYPE "MealTime" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateTable
CREATE TABLE "diet_orders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minimum_calories" INTEGER,
    "maximum_calories" INTEGER,

    CONSTRAINT "diet_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_diet_orders" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "diet_order_id" TEXT NOT NULL,

    CONSTRAINT "patient_diet_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tray_orders" (
    "id" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meal_time" "MealTime" NOT NULL DEFAULT 'BREAKFAST',
    "patient_id" TEXT NOT NULL,

    CONSTRAINT "tray_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tray_order_recipes" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "tray_order_id" TEXT NOT NULL,

    CONSTRAINT "tray_order_recipes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "patient_diet_orders" ADD CONSTRAINT "patient_diet_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_diet_orders" ADD CONSTRAINT "patient_diet_orders_diet_order_id_fkey" FOREIGN KEY ("diet_order_id") REFERENCES "diet_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tray_orders" ADD CONSTRAINT "tray_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tray_order_recipes" ADD CONSTRAINT "tray_order_recipes_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tray_order_recipes" ADD CONSTRAINT "tray_order_recipes_tray_order_id_fkey" FOREIGN KEY ("tray_order_id") REFERENCES "tray_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
