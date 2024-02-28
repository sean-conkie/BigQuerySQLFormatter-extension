check:
	yamllint -c .github/linters/.yamllint .
	markdownlint -c .github/linters/.markdown-lint.yml .