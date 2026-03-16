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

- [x] Review Prisma config
- [x] Upgrade local Prisma to the newest version and update config
- [x] Review database schema at `./prisma/schema.prisma` and add any indexes that would improve performance
- [x] Write query for selecting patients that don't have three scheduled meals for the day
- [x] Write query to select entrees, sides, and beverages
- [x] Define date boundaries for a smart-order run (`scheduled_for` within the target day)
- [x] Write query to fetch existing tray orders for Breakfast, Lunch, and Dinner per patient for a target date
- [x] Write query to calculate calories already consumed earlier in the day per patient
- [x] Write query to fetch each patient's calorie range from `patient_diet_orders` + `diet_orders`

## Code

- [ ] Add concise run logging (patients processed, meals created, meals skipped)
- [x] Implement a function for fetching patients missing one of three scheduled meals for the date
- [x] Implement a function for fetching food options (recipes)
- [x] Implement meal-time gap detection that excludes `SNACK`
- [x] Implement calorie-aware meal construction for each missing meal slot
- [x] Implement duplicate protection so reruns do not create duplicate tray orders
- [x] Implement transactional creation of `tray_orders` and `tray_order_recipes`
- [x] Implement `triggerSmartOrderSystem` orchestration with small typed helper functions

## Tests

- [x] Add `test/smartOrder.spec.ts` for core smart ordering behavior
- [x] Test that missing Breakfast/Lunch/Dinner meals are created for a patient
- [x] Test that existing meals are not duplicated
- [x] Test that `SNACK` is never auto-ordered
- [x] Test that daily calorie handling accounts for calories already consumed earlier in the day
- [x] Test idempotency by running `triggerSmartOrderSystem` twice

## Verification

- [ ] Document final tradeoffs and assumptions for the submitted MVP
- [x] Run `npm run test`
- [x] Run `npm start`
