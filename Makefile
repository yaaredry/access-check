.PHONY: dev test build run migrate stop clean logs lint lint-fix seed db-shell

PROD = docker-compose -f docker-compose.prod.yml
DEV  = docker-compose -f docker-compose.dev.yml -p access-check-dev

# ── Development ──────────────────────────────────────────────────────────────

# Start only the database for local development
dev-db:
	$(DEV) up -d postgres

# Stop dev database
dev-db-stop:
	$(DEV) down

# ── Deploy (build + test + run) ──────────────────────────────────────────────

deploy: build test run

# ── Production ───────────────────────────────────────────────────────────────

# Build all production Docker images
build:
	$(PROD) build

# Start all production containers, then restart nginx so it re-resolves
# upstream hostnames after all containers have their final IPs assigned.
run:
	$(PROD) up -d
	docker restart access-check-proxy

# Stop production containers
stop:
	$(PROD) down

# Tail production logs
logs:
	$(PROD) logs -f

# Remove production containers, volumes, and images
clean:
	$(PROD) down -v --rmi local

# ── Database ─────────────────────────────────────────────────────────────────

# Run migrations (against local backend, expects DB on 5433)
migrate:
	cd backend && node scripts/migrate.js

# Seed the default admin user
seed:
	cd backend && node scripts/seed.js

# Open a psql shell into the production database
db-shell:
	docker exec -it access-check-db psql -U postgres -d access_check

# ── Code quality ─────────────────────────────────────────────────────────────

test:
	$(DEV) up -d postgres
	@until docker exec access-check-db-dev pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	cd backend && npm test

lint:
	cd backend && npm run lint
	cd admin-console && npm run lint
	cd gate-client && npm run lint

lint-fix:
	cd backend && npm run lint:fix
	cd admin-console && npm run lint:fix
	cd gate-client && npm run lint:fix

# ── Dependencies ─────────────────────────────────────────────────────────────

install:
	cd backend && npm install
	cd admin-console && npm install
	cd gate-client && npm install
