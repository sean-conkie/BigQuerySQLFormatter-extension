# BigQuery SQL Formatter

[![Lint Code Base](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/actions/workflows/super-linter.yml/badge.svg)](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/actions/workflows/super-linter.yml)
[![CodeQL](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/actions/workflows/codeql.yml/badge.svg)](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/actions/workflows/codeql.yml)
[![Node.js Test](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/actions/workflows/node.js.yml/badge.svg)](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/sean-conkie/BigQuerySQLFormatter-extension/graph/badge.svg?token=ZOM3PNJ2SL)](https://codecov.io/gh/sean-conkie/BigQuerySQLFormatter-extension)

## VS Code extension providing BigQuery SQL syntax checking

The BigQuery SQL Formatter extension for Visual Studio Code provides syntax checking and formatting for BigQuery SQL
queries. This extension aims to enhance the development experience for users working with BigQuery by offering features
such as:

* Syntax Checking: Automatically checks the syntax of BigQuery SQL queries to ensure they are correct and conform to
best practices.
* Formatting: Provides tools to format SQL queries according to predefined styles, making the code more readable and
maintainable.
* Language Server Integration: Utilizes a language server to offer real-time feedback and suggestions as users write SQL
queries.
* Support for Multiple SQL Dialects: While aimed at BigQuery use, the extension supports various SQL dialects, including
standard SQL and GoogleSQL, ensuring compatibility with different BigQuery environments.
* Best Practices Enforcement: Encourages the use of best practices in SQL query writing, such as preferring LEFT JOIN
over RIGHT JOIN for better readability and maintainability.

This extension is particularly useful for developers and data analysts who frequently write and maintain BigQuery SQL
queries, providing them with tools to improve code quality and productivity.

## Configuration

### Fix on save

Add the following to your `settings.json`.

```json
  "[googlesql]": {
    "editor.codeActionsOnSave": {
      "source.fixAll": "explicit"
    }
  },
```
