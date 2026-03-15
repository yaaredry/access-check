.PHONY: dev test build run migrate stop clean logs

# Start all services in development mode
dev:
	docker-compose up --build

# Run all tests
test:
	cd backend && npm test

# Build Docker images
build:
	docker-compose build

# Run production containers
run:
	docker-compose up -d

# Run database migrations
migrate:
	cd backend && node scripts/migrate.js

# Stop all containers
stop:
	docker-compose down

# Remove containers, volumes, images
clean:
	docker-compose down -v --rmi local

# View logs
logs:
	docker-compose logs -f

# Install all dependencies
install:
	cd backend && npm install
	cd admin-console && npm install
	cd gate-client && npm install

# Lint all projects
lint:
	cd backend && npm run lint
	cd admin-console && npm run lint
	cd gate-client && npm run lint

# Seed the database
seed:
	cd backend && node scripts/seed.js

# Open a psql shell
db-shell:
	docker exec -it access-check-db psql -U postgres -d access_check
