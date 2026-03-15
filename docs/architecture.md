# Architecture

## Overview

```
┌─────────────────┐     ┌─────────────────┐
│  Admin Console  │     │   Gate Client   │
│  (React/Vite)   │     │  (React/Vite)   │
│   port 3002     │     │   port 3003     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └──────────┬────────────┘
                    │ REST / JSON
          ┌─────────▼──────────┐
          │   Backend API      │
          │  (Node/Express)    │
          │   port 3001        │
          └────────┬───────────┘
                   │
         ┌─────────▼──────────┐
         │   PostgreSQL DB    │
         │   port 5432        │
         └────────────────────┘
```

## Components

### Backend (`/backend`)
Layered Node.js/Express application:
- **controllers** — HTTP request/response handling, input validation
- **services** — business logic, orchestration
- **repositories** — all database queries via `pg`
- **middlewares** — auth JWT, rate limiting, error handler, validation runner

### Admin Console (`/admin-console`)
React SPA for administrators:
- JWT stored in `localStorage`
- CRUD operations on `people` table
- CSV bulk upload with row-level error reporting
- Pagination + search

### Gate Client (`/gate-client`)
Mobile-first React SPA for gate operators:
- No authentication required (deploy on local network or behind VPN)
- Manual ID entry form
- Camera capture → OCR → lookup
- Full-screen verdict display (green/red) with auto-reset

## Verification Flow

```
Gate operator → enters ID / takes photo
                     ↓
              POST /verify/id
           or POST /verify/image
                     ↓
           verifyService.verifyById / verifyByImage
                     ↓
            people table lookup
                     ↓
           check verdict + expiration
                     ↓
           return APPROVED | NOT_APPROVED | EXPIRED | NOT_FOUND
                     ↓
           audit_logs INSERT (fire-and-forget)
```

## OCR Pipeline

```
image buffer (never written to disk permanently)
      ↓
sharp: grayscale + normalize + sharpen
      ↓
tmp file write → tesseract (eng+heb) → tmp file delete
      ↓
regex extract: 9-digit IL IDs, 7-8 digit IDF IDs
      ↓
database lookup → verdict
```

## Database Schema

```
users             — admin login credentials
people            — allowed/denied identifiers
audit_logs        — all verify & admin events
schema_migrations — applied migration tracking
```

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT expiry: 8h
- Rate limits: 100 req/min globally, 30 req/min on /verify/*
- Images processed in-memory, temp file deleted immediately after OCR
- Helmet HTTP security headers
- Input validation via express-validator on every endpoint
- File upload size limit (default 5 MB)
