.PHONY: dev dev-db dev-db-stop test build run migrate stop clean logs lint lint-fix seed db-shell deploy-remote

# ── Remote server config (override on CLI or export in shell) ────────────────
SERVER  ?= YOUR_GCP_EXTERNAL_IP
SSH_KEY ?= ~/.ssh/access-check
SSH_USER ?= YOUR_GCP_USERNAME
APP_DIR  ?= /opt/access-check
DOMAIN   ?= your-domain.com

DOCKER = docker
# Use 'docker compose' (v2 plugin) if available, fall back to 'docker-compose' (v1 standalone)
COMPOSE = $(shell docker compose version > /dev/null 2>&1 && echo "docker compose" || echo "docker-compose")
PROD = $(COMPOSE) -f docker-compose.prod.yml
DEV  = $(COMPOSE) -f docker-compose.dev.yml -p access-check-dev

# ── Development ──────────────────────────────────────────────────────────────

# Start only the database for local development
dev-db:
	$(DEV) up -d postgres

# Stop dev database
dev-db-stop:
	$(DEV) down

# ── Deploy (build + test + run) ──────────────────────────────────────────────

deploy: build test run

# Push current branch to origin, then pull and redeploy on the remote server
deploy-remote:
	git push
	ssh -i $(SSH_KEY) $(SSH_USER)@$(SERVER) 'cd $(APP_DIR) && git pull && make deploy'

# ── Production ───────────────────────────────────────────────────────────────

# Build all production Docker images
build:
	$(PROD) build

# Start all production containers
run:
	$(PROD) up -d

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
	$(DOCKER) exec -it access-check-db psql -U postgres -d access_check

# ── Code quality ─────────────────────────────────────────────────────────────

test:
	$(DEV) up -d postgres
	@until $(DOCKER) exec access-check-db-dev pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
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
