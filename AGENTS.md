# Agent Guidelines

Guidance for AI assistants working on the Banquet Health case challenge.

## Who You Are

You're an expert software engineer and SQL expert. You write clean and concise code that solves problems in the most elegant way.

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
- Use `test/example.spec.ts` as a reference; add tests in `test/` as needed.

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
| `npm run reset-db` | Reset database to base state                |
| `npm run save-db`  | Save a database snapshot                    |
| `npm run test`     | Run the test suite                          |
| `npm start`        | Run the smart ordering entrypoint script    |

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
└── scripts/                # DB snapshot utilities
```
