# MongoDB API contract tests

These tests freeze the current MongoDB-backed HTTP behavior before the PostgreSQL/Prisma migration.

## Destructive-test safety

The suite deletes seeded documents before each test and drops its database at shutdown. It therefore fails closed unless all of these conditions are met:

1. `MONGODB_URI` points to a disposable MongoDB test instance.
2. `MONGODB_CONTRACT_ALLOW_DESTRUCTIVE=true` is set explicitly.
3. If `MONGODB_DB_NAME` is supplied, it matches the generated-only format:
   `pa_penajam_contract_test_<pid>_<13-digit-timestamp>_<8-hex-random>`.

Do not use a production or shared MongoDB URI. Unsafe, default, short, or otherwise non-generated database names are rejected before the direct client or Next.js server is constructed, and the same validation is repeated before `deleteMany` and `dropDatabase`.

Normally, omit `MONGODB_DB_NAME`; the suite generates a unique safe name and passes that exact validated name to both its direct MongoDB client and the application server.

```bash
MONGODB_URI='mongodb://127.0.0.1:27017' \
MONGODB_CONTRACT_ALLOW_DESTRUCTIVE=true \
yarn test:contract
```

Without the required variables, non-database fixture and safety tests run while the live HTTP contract tests are skipped. Supplying `MONGODB_URI` with an unsafe database name or without the destructive opt-in causes an immediate failure rather than a skip.

## Coverage inventory

`fixtures/mongodb-baseline.json` lists every route dispatched by `app/api/[[...path]]/route.js`. The operational `/api/seed` route is explicitly inventoried but intentionally not invoked; fixtures are inserted directly into the validated disposable database. The suite covers public and authenticated reads, validation and authorization failures, representative and domain-wide successful CRUD, upload/media integration, CORS, search, download, bulk, config, and catch-all behavior.
