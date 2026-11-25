# Makefile — one set of commands for every project, whatever the stack.
# CI (.github/workflows/pre-merge.yml, added in KQ-3) calls exactly these targets.
#
#   make install           install dependencies
#   make dev               run the app locally on http://localhost:3000
#   make lint typecheck    static checks
#   make test-unit         fast logic tests (Vitest)
#   make test-integration  tests against local Supabase (from KQ-4)
#   make test-e2e          browser tests (Playwright); E2E_SCOPE=smoke|full
#   make build             production build
#   make check             everything to run before pushing

#   make rtl-check         fail on physical left/right styling (see scripts/rtl-check.mjs)
#
# Database (local Supabase in Docker):
#   make db-start          start the local stack and apply all migrations
#   make db-reset          wipe the local DB and re-apply migrations from scratch
#   make db-types          regenerate lib/database.types.ts from the local schema
#   make db-types-check    fail if lib/database.types.ts is out of date (used by CI)
#   make db-stop           stop the local stack

.PHONY: install dev lint typecheck rtl-check test-unit test-integration test-e2e build check \
        db-start db-reset db-types db-types-check db-stop

install:
	npm ci

dev:
	npm run dev

lint:
	npm run lint

typecheck:
	npx next typegen
	npm run typecheck

rtl-check:
	node scripts/rtl-check.mjs

test-unit:
	npm run test:unit

test-integration:
	npm run test:integration

E2E_SCOPE ?= full
test-e2e:
	E2E_SCOPE=$(E2E_SCOPE) npm run test:e2e

build:
	npm run build

check: lint typecheck rtl-check test-unit

# Services the app doesn't use locally; skipping them makes `supabase start` faster.
DB_EXCLUDE = studio,imgproxy,mailpit,logflare,vector,edge-runtime,supavisor

db-start:
	npx supabase start -x $(DB_EXCLUDE)

db-reset:
	npx supabase db reset

db-types:
	npx supabase gen types --lang typescript > lib/database.types.ts

db-types-check:
	npx supabase gen types --lang typescript > /tmp/database.types.ts
	@diff -u lib/database.types.ts /tmp/database.types.ts || \
	  (echo "::error::lib/database.types.ts is out of date. Run 'make db-types' and commit. Generated version:"; \
	   cat /tmp/database.types.ts; exit 1)

db-stop:
	npx supabase stop
