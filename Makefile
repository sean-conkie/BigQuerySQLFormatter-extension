
.PHONY: check fix
check:
	markdownlint -c .github/linters/.markdown-lint.yml .
	npm run lint

fix:
	markdownlint -c .github/linters/.markdown-lint.yml --fix .

.PHONY: docs

docs:
	@cd docs && make dirhtml

.PHONY: version ensure-clean
# If the first argument is "add"...
ifeq (version,$(firstword $(MAKECMDGOALS)))
  # Use the rest as arguments for "add"
  VERSION := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  # Tell Make to treat these as normal arguments, not targets
  $(eval $(VERSION):;@:)
endif
version: ensure-clean
	@echo "Setting version to $(VERSION)"
	@cd ./server && npm version $(VERSION) && cd ..
	@cd ./client && npm version $(VERSION) && cd ..
	@git add .
	@git commit -m "Version $(VERSION)" -q
	@npm version $(VERSION) --no-git-tag-version
	@echo "Version $(VERSION) set"

ensure-clean:
	@git diff-index --quiet HEAD -- || { echo "Error: Working directory is not clean. Commit or stash your changes."; exit 1; }