# Overview

This file contains the plan for solving the Banquet Health case challenge.

## Files

Read the following files:

- `./AGENTS.md`
- `./docs/email.md`

Follow the guidelines in the AGENTS file, and solve only for the problem as it is described in the `email.md` file unless I instruct you to do otherwise.

## Task Rules

- Follow the tasks format below when adding additional items
- Check off completed task items when complete and move them to the bottom of their respective list
- Ask for what you should work on next and only work on that task

## Initial Tasks

- [x] Review this file, and the `AGENTS.md` and `./docs/email.md` files
- [x] Understand the problem we are solving for
- [x] Review the code base and update this file with tasks that should be addressed
- [x] Install NPM package to read environment variables from `.env`
- [x] Align Prisma connection usage so runtime and tests both use `.env` safely

## Database

- [ ] Write query for selecting patients that don't have three scheduled meals for the day
- [ ] Write query to select entrees, sides, and beverages
- [ ] Define date boundaries for a smart-order run (`scheduled_for` within the target day)
- [ ] Write query to fetch existing tray orders for Breakfast, Lunch, and Dinner per patient for a target date
- [ ] Write query to calculate calories already consumed earlier in the day per patient
- [ ] Write query to fetch each patient's calorie range from `patient_diet_orders` + `diet_orders`
- [x] Review Prisma config
- [x] Upgrade local Prisma to the newest version and update config
- [x] Review database schema at `./prisma/schema.prisma` and add any indexes that would improve performance

## Code

- [ ] Implement a function for fetching patients missing one of three scheduled meals for the date
- [ ] Implement a function for fetching food options (recipes)
- [ ] Implement meal-time gap detection that excludes `SNACK`
- [ ] Implement calorie-aware meal construction for each missing meal slot
- [ ] Implement duplicate protection so reruns do not create duplicate tray orders
- [ ] Implement transactional creation of `tray_orders` and `tray_order_recipes`
- [ ] Implement `triggerSmartOrderSystem` orchestration with small typed helper functions
- [ ] Add concise run logging (patients processed, meals created, meals skipped)

## Tests

- [ ] Add `test/smartOrder.spec.ts` for core smart ordering behavior
- [ ] Test that missing Breakfast/Lunch/Dinner meals are created for a patient
- [ ] Test that existing meals are not duplicated
- [ ] Test that `SNACK` is never auto-ordered
- [ ] Test that daily calorie handling accounts for calories already consumed earlier in the day
- [ ] Test idempotency by running `triggerSmartOrderSystem` twice

## Verification

- [ ] Run `npm run test`
- [ ] Run `npm start`
- [ ] Document final tradeoffs and assumptions for the submitted MVP
