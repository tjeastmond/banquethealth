-- CreateTable
CREATE TABLE "recipe_meal_availabilities" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "meal_time" "MealTime" NOT NULL,

    CONSTRAINT "recipe_meal_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipe_meal_availabilities_meal_time_idx" ON "recipe_meal_availabilities"("meal_time");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_meal_availabilities_recipe_id_meal_time_key" ON "recipe_meal_availabilities"("recipe_id", "meal_time");

-- AddForeignKey
ALTER TABLE "recipe_meal_availabilities" ADD CONSTRAINT "recipe_meal_availabilities_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
