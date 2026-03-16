# Agent Guidelines

Guidance for AI assistants working on the Banquet Health case challenge.

## Who You Are

You're an expert software engineer and SQL expert. You write clean and concise code that solves problems in the most elegant way.

## Git

- All commit messages **MUST** follow the Conventional Commits standard.

## Implementation Guardrails

### Scope

- **Implement core ordering logic only.** API routes and UI components are out of scope.
- Primary implementation lives in `src/smartOrder.ts` — implement `triggerSmartOrderSystem` there.
- You have full freedom to modify schema, seed data, directory structure, or language if it yields a cleaner solution.

### Product Requirements

1. **Meal coverage:** Each patient must receive a tray order for Breakfast, Lunch, and Dinner. The Smart Ordering system should _not_ be responsible for Snacks.
2. **No duplicates:** If a patient has already ordered a meal, do not place a duplicate order.
3. **Caloric constraints:** Diet Orders specify minimum and maximum daily calories. Account for what a patient has already consumed earlier in the day.

### Code Quality

- MVP focus: Make the core workflow functional before adding extras.
- Clear structure and modular functions.
- Pragmatic and focused — clarity over complexity.
- A complete, well-reasoned MVP with clean structure scores higher than a broad but shallow solution.
- Document rationale for key decisions and tradeoffs.
- All code **MUST** be strictly typed TypeScript.

### Testing

- Write tests for core behavior before or alongside implementation.
- Tests reset the database state before each run.
- Use `test/database.spec.ts` as a reference; add tests in `test/` as needed.

### AI Usage

- AI tools are allowed, but avoid excessive low-value AI-generated content.
- Keep code small, elegant, and concise.

## npm Scripts

| Script             | Description                                 |
| ------------------ | ------------------------------------------- |
| `npm run db-up`    | Start the Postgres Docker container         |
| `npm run db-down`  | Stop the Postgres container                 |
| `npm run db-clean` | Stop Postgres and remove persistent volumes |
| `npm run init-db`  | Initialize and seed the database            |
| `npm run reset-db` | Truncate seeded tables and reseed from CSV  |
| `npm run test`     | Run the test suite                          |
| `npm run typecheck`| Run the TypeScript compiler without emit    |
| `npm start`        | Run the smart ordering entrypoint script    |

## Verification Commands

- Run `npm run test` to verify the Jest suite against the seeded database reset flow.
- Run `npm run format` to apply the repo's Prettier formatting before finishing work.
- Run `npm run typecheck` to verify TypeScript correctness without emitting build output.

## Database Connection

```
postgresql://postgres:local@127.0.0.1:5442/dev
```

- Host: 127.0.0.1 | Port: 5442 | Database: dev | User: postgres | Password: local

## Project Structure

```
case-challenge/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed/
│       └── rawData/        # Sample seed data (CSV)
├── src/
│   ├── smartOrder.ts       # Implement triggerSmartOrderSystem
│   └── entrypoint.ts       # Script entrypoint
├── test/
│   └── *.spec.ts           # Test specs
└── scripts/                # DB reset utilities
```

## Test Database Lifecycle

- `npm run reset-db` is the canonical reset path for local development and tests.
- The reset script truncates seeded tables and reloads data from the CSV files in `prisma/seed/rawData`.
- `npm run test` uses that same CSV reseed flow before each test.
- Do not add snapshot generation or tracked snapshot artifacts back into the automated test setup.

## Adding Seed Patients

- Add the patient to `prisma/seed/rawData/patients.csv`.
- Add that patient's diet link to `prisma/seed/rawData/patient_diet_orders.csv`.
- Add any pre-existing meal schedule rows to `prisma/seed/rawData/tray_orders.csv`.
- Add matching recipe links for those tray orders to `prisma/seed/rawData/tray_order_recipes.csv`.
- Reuse the same service date already present in the base seed data unless the task explicitly requires a different date.
- Do not add one-off tests for every newly seeded patient. The existing seeded coverage for Mark Corrigan, Bob Belcher, and Calvin Fischoeder is sufficient for validating the different meal-state scenarios.
