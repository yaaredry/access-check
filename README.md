# Access-Check

Access control verification system for secured locations. Gate operators can verify individuals by manually entering ID numbers or capturing photos of ID cards via OCR. Administrators manage the allow/deny list and view audit logs.

## Features

- **Gate Client** — Mobile-first UI for verifying access via manual ID entry or camera capture
- **Admin Console** — CRUD management of the people list, CSV bulk upload, audit log
- **OCR Pipeline** — Multi-pass Tesseract OCR with image preprocessing for Israeli ID cards
- **REST API** — JWT-authenticated backend with rate limiting and full audit trail
- **Verdict Types** — `APPROVED`, `NOT_APPROVED`, `EXPIRED`, `NOT_FOUND`

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Tesseract OCR with `eng` and `heb` language packs

## Getting Started

### Development (with hot reload)

```bash
cp .env.example .env        # configure environment
npm run install:all         # install deps in all packages
npm run migrate             # apply DB migrations
npm run seed                # create default admin user
npm run dev                 # start all services with live reload
```

Services:
- API: http://localhost:3001
- Admin Console: http://localhost:3002
- Gate Client: http://localhost:3003

### Production (Docker)

```bash
make build   # build images
make run     # start all containers
make logs    # tail logs
make stop    # stop containers
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Full Postgres connection string |
| `JWT_SECRET` | Long random secret for signing tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `8h`) |
| `PORT` | Backend port (default `3001`) |
| `DEFAULT_ADMIN_USERNAME` | Initial admin username (seed only) |
| `DEFAULT_ADMIN_PASSWORD` | Initial admin password (seed only) |
| `RATE_LIMIT_MAX` | Global requests per window (default `100`) |
| `MAX_UPLOAD_SIZE_MB` | Max CSV/image upload size (default `5`) |

> Docker Compose exposes PostgreSQL on port **5433** to avoid conflicts with a local Postgres instance.

## API Overview

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | — | Get JWT token |
| `GET` | `/people` | JWT | List people (search, pagination) |
| `POST` | `/people` | JWT | Add person |
| `PUT` | `/people/:id` | JWT | Update person |
| `DELETE` | `/people/:id` | JWT | Remove person |
| `POST` | `/people/upload-csv` | JWT | Bulk import |
| `POST` | `/verify/id` | — | Verify by identifier |
| `POST` | `/verify/image` | — | Verify by ID card photo |
| `GET` | `/health` | — | Health check |

## Database

PostgreSQL with three tables: `users`, `people`, `audit_logs`.

```bash
npm run migrate    # run migrations
npm run seed       # seed default admin
make db-shell      # open psql shell
```

## Testing & Linting

```bash
make test       # run backend Jest tests
make lint       # lint all packages
make lint:fix   # auto-fix lint issues
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20, Express 4, PostgreSQL 15 |
| Frontend | React 18, Vite, React Router v6 |
| OCR | Tesseract (node-tesseract-ocr), Sharp |
| Auth | JWT (8h), bcrypt (12 rounds) |
| Security | Helmet, express-rate-limit, express-validator |
| Infra | Docker, Docker Compose |
