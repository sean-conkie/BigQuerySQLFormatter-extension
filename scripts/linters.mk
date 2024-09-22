check:
	markdownlint -c .github/linters/.markdown-lint.yml .
	npm run lint

fix:
	markdownlint -c .github/linters/.markdown-lint.yml --fix .