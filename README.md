# Banquet Health Case Challenge

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
- You have __full freedom to modify any part of the codebase__ — including the schema, seed data, directory structure, and even the coding language — if it helps you implement a cleaner or more effective solution
- Keep your solution pragmatic and focused. We value clarity over complexity.

## Submission
Once you are finished, you can upload the entire `case-challenge` directory to google drive link provided in the email.  Note that a __separate__ link was provided just for your submission - you will not be able to upload your solution to the same directory that you downloaded this file from.  You may also want to run `npm run db-clean` to stop the docker container and remove its volumes.

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
