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

.PHONY: install dev lint typecheck test-unit test-integration test-e2e build check

install:
	npm ci

dev:
	npm run dev

lint:
	npm run lint

typecheck:
	npx next typegen
	npm run typecheck

test-unit:
	npm run test:unit

test-integration:
	npm run test:integration

E2E_SCOPE ?= full
test-e2e:
	E2E_SCOPE=$(E2E_SCOPE) npm run test:e2e

build:
	npm run build

check: lint typecheck test-unit
