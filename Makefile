# Thin wrapper around scripts/make.mjs so Linux, macOS, CI and Windows share one implementation.
.PHONY: up setup dev seed test demo reset models contracts lint typecheck e2e migrate

up setup dev seed test demo reset models contracts lint typecheck e2e migrate:
	node scripts/make.mjs $@
