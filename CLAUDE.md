# CLAUDE.md

## Project Overview

Access control verification system — monorepo with three packages:

- `backend/` — Node.js/Express REST API (port 3001)
- `admin-console/` — React/Vite admin SPA (port 3002)
- `gate-client/` — React/Vite mobile-first gate operator SPA (port 3003)

Database: PostgreSQL (port 5433 in Docker, 5432 locally).

## Development Commands

```bash
npm run dev            # start all services with live reload (kills :3001/:3002/:3003 first)
npm run install:all    # install deps in all packages
npm run migrate        # run DB migrations
npm run seed           # seed default admin user
make test              # run backend Jest tests
make lint              # lint all packages
make build && make run # production Docker build + start
```

## Architecture

```
POST /verify/image  →  ocrService (Sharp preprocessing → Tesseract multi-pass)
                    →  verifyService (DB lookup → verdict)
                    →  auditRepository (log result)

POST /verify/id     →  verifyService → auditRepository

Admin routes        →  JWT middleware → controllers → repositories
```

Key files:
- `backend/src/services/ocrService.js` — multi-pass OCR pipeline (do not simplify without testing)
- `backend/src/services/verifyService.js` — core verdict logic
- `backend/migrations/001_initial.sql` — schema (enums, tables, indexes)

## Identifier Types

- `IL_ID` — Israeli Teudat Zehut (9 digits, Luhn-style checksum validation)
- `IDF_ID` — IDF service number (7–8 digits)

Verdicts: `APPROVED`, `NOT_APPROVED`, `EXPIRED`, `NOT_FOUND`

## Security Notes

- Gate Client has **no auth** — intended for local network / VPN only
- Admin Console requires JWT in `Authorization: Bearer <token>` header
- File uploads are memory-only (multer); OCR temp files deleted immediately after processing
- All DB queries use parameterized statements (no string interpolation)

## Testing

```bash
npm test --prefix backend
```

Test files in `backend/tests/`: `ocr.test.js`, `people.test.js`, `verify.test.js`.

Do not mock the database in integration tests — use the real DB.

## Environment

Copy `.env.example` to `.env`. Docker Compose maps Postgres to **5433** externally.
JWT_SECRET must be changed for any non-local deployment.
