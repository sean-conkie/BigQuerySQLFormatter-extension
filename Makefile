
.PHONY: check fix
check:
	markdownlint -c .github/linters/.markdown-lint.yml .
	npm run lint

fix:
	markdownlint -c .github/linters/.markdown-lint.yml --fix .

.PHONY: docs

docs:
	@cd docs && make dirhtml

.PHONY: version
# If the first argument is "add"...
ifeq (version,$(firstword $(MAKECMDGOALS)))
  # Use the rest as arguments for "add"
  VERSION := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  # Tell Make to treat these as normal arguments, not targets
  $(eval $(VERSION):;@:)
endif
version:
	@npm version $(VERSION)
	@cd ./server && npm version $(VERSION) && cd ..
	@cd ./client && npm version $(VERSION)
	echo "Version $(VERSION) set"