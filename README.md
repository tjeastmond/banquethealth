# Banquet Health Case Challenge

## Solution Overview

This submission implements the smart ordering MVP for scheduled Breakfast, Lunch, and Dinner coverage in strictly typed TypeScript. The core flow lives in `src/smartOrder.ts` and is split into small query and meal-planning helpers so the ordering workflow stays easy to follow and test.

### What I Implemented

- Detect patients who are missing one or more scheduled meals for the service date.
- Ignore snack coverage when deciding which meals need to be created.
- Account for calories already scheduled earlier in the day, including snacks, before planning missing meals.
- Build meal combinations from eligible entree, side, and beverage options for each meal slot.
- Skip a missing meal instead of creating an order that would exceed the patient's daily maximum calories.
- Re-check for existing same-day meal coverage inside a serializable transaction before inserting tray orders to avoid duplicates on reruns.
- Return a run summary with per-patient outcomes for debugging and verification.

### Key Decisions and Tradeoffs

- I treated the minimum calorie target as a planning goal rather than a hard guarantee. If the remaining calorie budget cannot satisfy both the minimum and maximum constraints, the system prefers not to exceed the maximum.
- I used a deterministic meal-selection strategy that ranks eligible combinations by calorie fit instead of adding more complex optimization logic. That keeps the MVP small, predictable, and easy to reason about within the time box.
- I fail fast when a scheduled meal has no eligible entree or beverage options. That surfaces invalid menu configuration immediately instead of silently creating partial trays.
- I kept the scope on core ordering logic and test coverage.

### Schema and Data Changes

- Added recipe-to-meal availability data so smart ordering can query foods by scheduled meal.
- Tightened patient diet modeling to enforce one diet plan per patient at the database level.
- Expanded seed coverage to represent patients with full, partial, and missing meal schedules.

### CLI and Reporting

- Added `npm run report` to render an ASCII tray-order report for the seeded service date.
- The report shows breakfast/lunch/dinner coverage, planned calories, diet ranges, and missing meal slots.
- I used the report as a quick validation tool for seed data and smart order outcomes.

### Seed Data Notes

- I kept the seeded service date consistent across fixtures so tests and reports stay deterministic.

### Test Coverage

- Added end-to-end smart order tests for meal coverage, duplicate prevention, calorie accounting, idempotency, and max-calorie skips.
- Added query-level tests for missing-meal detection, scheduled calorie totals, food option filtering, and diet-plan constraints.
- Added entrypoint tests for summary logging and failure handling.
- Added tray-order report tests to verify rendered coverage and duplicate-meal detection.

### Reset and Test Flow

- Tests reset the database from CSV seed data before each spec instead of relying on tracked snapshots.
- I sped up the reset path so the suite still runs quickly with stronger integration coverage.
- `npm run reset-db` remains the canonical local reset command and matches the test reseed flow.

### Verification

- `npm run test`
- `npm run typecheck`
- `npm run format -- --check`

---

This challenge is designed to evaluate skills across several key areas:

- Coding proficiency
- Technical tradeoff analysis
- Product thinking and requirement interpretation

## Prerequisites

- Docker
- node.js >= 20
- npm >= 10

## Overview

At Banquet Health, patients are assigned Diet Orders by healthcare staff to regulate their daily caloric intake. Patients normally browse and submit their own meal selections through our platform. However, not all patients submit orders in time.

To prevent missed meals, hospitals need a system that automatically generates orders matching each patient’s dietary requirements.

Your task is to implement a Smart Ordering function that:

1. Automatically places orders when patients have not done so.

2. Ensures those orders meet each patient’s dietary constraints.

Implement the core ordering logic only. API routes and a UI component are out of scope.

## Directory Structure

You will primarily work with the following files:

```
case-challenge/
├── prisma/
│   ├── schema.prisma       # Database schema definition
│   └── seed/
│       ├── rawData/        # Sample seed data
├── src/
│   ├── smartOrder.ts       # Implement triggerSmartOrderSystem here
├── test/
│   ├── database.spec.ts     # Database reset tests; add more as needed
```

## Getting started

This exercise uses Docker to spin up a Postgres database and seed it with sample data.

```
npm install
npm run db-up     # Start the Postgres container
docker ps         # Verify that the status of the conatiner "banquet-health-case-challenge-postgres-1" is "Up" before continuing
npm run init-db   # Seed the database with sample data
npm run test      # Test that everything is working correctly
```

You can connect via a GUI tool such as PgAdmin using the following configuration:

- Host: 127.0.0.1
- Port: 5442 (not the default 5432, to avoid conflicts)
- Database: dev
- User: postgres
- Password: local

A simple test framework has also been provided. Tests reset the database state before each run by truncating the seeded tables and reseeding from the CSV files in `prisma/seed/rawData`.

- Run tests with: npm run test
- See test/database.spec.ts for a sample test
- Raw CSV seed data is available in prisma/seed/rawData

## Product Requirements

The requirements are intentionally minimal. As a startup, engineers must often act like product managers — evaluating trade-offs, proposing improvements, and knowing when to prioritize simplicity. We encourage you to think critically and make reasonable assumptions.

- Each patient must receive a tray order for Breakfast, Lunch, and Dinner, but the Smart Ordering system should not be responsible for ordering them a Snack
- If a patient has already ordered a meal, the Smart Ordering system should not place a duplicate order.
- Diet Orders specify minimum and maximum daily calories. Your system should account for what a patient has already consumed earlier in the day.

## Guidelines

- Aim to spend no more than 2 hours in total
- You are encouraged to use AI tools (e.g., Copilot, ChatGPT, Cursor) as you normally would in your workflow
- You have **full freedom to modify any part of the codebase** — including the schema, seed data, directory structure, and even the coding language — if it helps you implement a cleaner or more effective solution
- Keep your solution pragmatic and focused. We value clarity over complexity.

## Submission

Once you are finished, you can upload the entire `case-challenge` directory to google drive link provided in the email. Note that a **separate** link was provided just for your submission - you will not be able to upload your solution to the same directory that you downloaded this file from. You may also want to run `npm run db-clean` to stop the docker container and remove its volumes.

## Useful Commands

#### Spin up postgres

npm run db-up

#### Spin down postgres

npm run db-down

#### Spin down postgres and remove persistent data

npm run db-clean

#### Initialize and seed database

npm run init-db

#### Reset Database to base state

This reset flow truncates the seeded tables and reloads the baseline data from the CSV seed files. `npm run test` uses the same CSV-based reset path before each test.

npm run reset-db

#### Run tests

npm run test

#### Run the script

npm start
