check:
	yamllint -c .github/linters/.yamllint.yml .
	markdownlint -c .github/linters/.markdown-lint.yml .
	standard

fix:
	markdownlint -c .github/linters/.markdown-lint.yml --fix .
	standard --fix