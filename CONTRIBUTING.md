# Contributing

## Getting started

Use Node.js 22.12 or newer in the Node.js 22 release line and Visual Studio Code
1.91 or newer. LSP client/server 10 requires that Visual Studio Code minimum.
API types are pinned to 1.91.0 so compilation cannot silently use newer APIs.

```sh
npm ci
npm run compile
npm run watch
```

The root install also installs locked client and server dependencies.
Watch mode watches TypeScript types and esbuild bundles. Open this repository in
Visual Studio Code, choose **Run > Start Debugging**, and use an Extension Development Host
launch configuration with `--extensionDevelopmentPath` pointing to this checkout.
If no launch configuration exists, select `VS Code Extension Development` when
creating one. Open a `.bqsql` file in the development host to exercise the extension.

## Checks

The following checks run on all pull requests, including stacked branches, and
pushes to `main`:

```sh
npm run lint
npm run compile
npm run coverage
npx --no-install vsce package --no-yarn --out extension.vsix
npm run package:check
npm run citest
```

TypeScript linting and formatting use pinned Biome 2.6.2 with two-space
indentation, single quotes, and semicolons. `npm run lint` checks both;
`npm run lint:fix` applies safe lint fixes and formatting, and `npm run format`
only formats. CI uses `biome ci` to reject violations. Super-linter's overlapping
formatters are disabled. Markdown uses `.github/linters/.markdown-lint.yml`;
`make check` runs Markdown and TypeScript checks when `markdownlint` is installed.

Formatting-only commits are listed in `.git-blame-ignore-revs`. Configure blame
to skip them:

```sh
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

A separate JSCPD step compares changed pull request files with the same files at
the PR base. It retains the 5% duplication target and rejects increases above an
existing higher baseline. Both snapshots are normalized with the same pinned
formatter before comparing token percentages, so quote styles and line wrapping
do not manufacture regressions. Comments and tests are excluded. Generated npm
lockfiles and the generated function catalog are excluded because their repeated
metadata is not hand-written source code.

Actions are pinned to commit hashes. Lint results appear in the workflow summary
without requiring permission to post pull request comments.

## Testing

`npm test` runs server unit tests after compilation. `npm run coverage` also
generates `coverage/lcov.info` and fails if overall branch coverage falls below
80%. CI uploads coverage to Codecov using `CODECOV_TOKEN`. Fork pull requests use
public-repository tokenless uploads; configure the token as a Dependabot secret
as well to enable uploads from Dependabot PRs.

Regression tests cover multiline incremental edits and CRLF, directive edge
cases, diagnostic limits, and overlapping fix-all edits while preserving
individual quick fixes.

### Extended query coverage

Pipe syntax (including FROM-only queries), `MATCH_RECOGNIZE`, `GRAPH_TABLE` and
`FOR SYSTEM_TIME AS OF` are highlighted and preserved by the parser. Structural
rules skip the query block that directly contains unsupported syntax, together
with its descendants, not the whole enclosing statement. Traditional enclosing
queries, sibling CTEs and subqueries are still linted and can be fixed or formatted.
The parser exposes isolated child queries through `StatementAST.queryBlocks`;
`hasExtendedQuerySyntax` describes the current block, not its children.

CP01-CP05, CV01, CV02, CV04, CV05, CV13, LT01, LT12 and LT13 remain safe throughout
extended queries. Other rules must opt into `extendedQuerySafeRules` only after
they support the new structures. Phase 1 of #404 does not add pipe-stage clause
models or enable additional rules inside unsupported query blocks.

Mixed-query regression tests cover AST, source-based and regex rules, opaque
projection counts, incomplete queries, incremental edits, protected fix ranges,
and idempotent formatting/Fix All with LF, CRLF and CR line endings.

`npm run citest` runs server tests followed by client end-to-end tests. These
download and launch Visual Studio Code and require a display. On headless Linux:

```sh
xvfb-run -a npm run citest
```

Packaging and end-to-end CI run on Linux, macOS, and Windows. End-to-end CI covers
both Visual Studio Code 1.91.0 and stable. Set `BQSQL_TEST_VSCODE_VERSION=1.91.0` to run the
minimum-version tests locally.

Set `BQSQL_TEST_VSIX` to the absolute path of a VSIX when running `npm run citest`
to install it into the isolated test profile and run diagnostics tests against
its packaged contents instead of the source checkout. CI uses this mode on all
three operating systems.

The test runner waits for native workbench contributions, including save
participants, through the Visual Studio Code smoke-test driver before running
tests. Its debugging and readiness endpoints bind only to the loopback interface.

## Refreshing function completions

Run `npm run generate:completions` with network access to refresh the committed
`server/src/completions/functions.json` catalog and the generated function scopes
in `server/src/linter/syntaxes/googlesql.tmLanguage.json`. The generator reads the
English BigQuery all-functions reference plus AI/ML reference navigation, then
fetches linked pages for signatures. It records names, signatures, descriptions,
and documentation links in sorted order, without timestamps. Re-running against
unchanged reference pages produces identical output.

The source is Google's [BigQuery function reference](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/functions-all).

Commit both generated outputs together. Do not edit the catalog or the
`generatedFunctions` grammar entry by hand. Existing grammar patterns remain for
special syntax such as `SAFE.` and functions used without parentheses. Builds
and tests use committed data and do not fetch documentation.
Generated patterns retain existing function-category scopes for parser
compatibility; newly discovered functions use the shared `function.builtin`
parser rule in `server/src/linter/syntaxes/syntax.json`.

After regenerating, run `npm run compile` and `npm test`. The offline generator
tests check reference extraction and catalog/grammar synchronization; server
tests exercise completion, hover, and actual TextMate scopes for the catalog.
If Google changes the reference layout, the generator fails explicitly rather
than silently omitting signatures or descriptions; update its extraction logic
and fixtures before committing refreshed data.

## Packaging and release

Packaging type-checks and bundles the extension through the VSCE prepublish hook.
The client and server are bundled with esbuild into `dist/`; grammar JSON and
`onig.wasm` are copied alongside them. No `node_modules` directories are shipped.
Bundled dependency licenses and notices are retained in
`dist/ThirdPartyNotices.txt`.

`.vscodeignore` is an allow-list: it excludes everything except explicitly
included runtime files. The VSIX excludes documentation (including this guide),
tests, CI files, development configuration, local virtual environments, and
root SQL scratch files. `npm run package:check` checks the file list for
regressions and verifies that grammar JSON, Oniguruma Wasm, extension entry
points, and the Marketplace icon are preserved.

The readme is the Marketplace page; keep contributor details here and use
absolute GitHub links when linking here from the readme.

Release publishing uses Node.js 22 and the locked local `@vscode/vsce`
dependency in `.github/workflows/publish.yml`, with `VSCE_PAT` supplied by the
repository secret. Update the changelog and keep root, client, and server
package versions consistent when preparing a release.

## Dependencies

Run `npm audit --audit-level=high` in the root, `client`, and `server` directories
to check tooling and runtime dependencies. Dependabot monitors all three npm
manifests and GitHub Actions weekly, grouping minor and patch updates with a
seven-day cooldown.

Node types stay on 22.x. Chai and sinon-chai major upgrades are deferred until
the assertion test harness migrates to ESM. The unused `@vscode/test-cli`
dependency has been removed; end-to-end tests use `@vscode/test-electron` directly.
Server tests use Mocha 12; the client test runner uses Mocha 11 so it also works
with the older embedded Node.js in the minimum supported Visual Studio Code version.
Client-only Mocha overrides select patched `diff` and `serialize-javascript`
versions until the compatible runner incorporates those updates upstream.

The packaging tool's Azure Identity dependency temporarily overrides MSAL Node
to a patched release. Remove this override when Azure Identity supports the
patched version directly.

## Architecture notes

Multiline comments and strings are tracked across lines during initial parsing
and editing. Incremental edits re-tokenize from the first changed line through
the end of the document using the preceding line's TextMate state, so subsequent
diagnostics reflect the current document without reopening it.

Closing a document clears its diagnostics and evicts its token and settings
caches. Reopening it parses the current contents afresh.

Edits update the server's document snapshot immediately and debounce validation
until 250 ms after the most recent change. Superseded or closed-document work is
cancelled, and diagnostics are published only for the current version. Parsing
yields between tokenization batches and during statement processing so incoming
edits and LSP request cancellations can be handled. Loaded grammars are shared,
and each open document reuses its parser and rule instances until it is closed.
Opening a document and changing configuration trigger immediate validation.

Regex-based diagnostics use TextMate token scopes to exclude matches inside
strings, quoted identifiers, and comments, on both open and edit. Matching uses
the original source text so diagnostic and quick-fix offsets stay unchanged.
Style and best-practice diagnostics default to Warning rather than Error.
Rules share a central registry and reusable regular expression/parser bases.
Regular expression ranges use explicit named target groups so contextual matches
do not alter fix ranges.

Structural rules use the source-token helpers in
`server/src/linter/rules/source.ts`, which shield comments and literals even
when incomplete SQL causes the highlighting grammar to lose scopes. Shared CTE
navigation lives in `server/src/linter/rules/queries.ts`. Fixable source rules
cache edits per document and diagnostic range and clear them on close.

Pipe queries, pattern recognition, graph queries and temporal table references
retain their complete source tokens in the AST. Pipe stages record their operator,
nesting depth and tokens. Until structural rules understand these constructs,
statements containing them are excluded from the traditional SELECT AST passed
to rules, and their structural diagnostics/fixes are suppressed. This includes
an enclosing traditional query when the new syntax occurs inside a CTE or subquery.
The explicit syntax-independent rule allow-list in `server/src/linter/linter.ts`
keeps CP01-CP05, CV01, CV02, CV04, CV05, CV13, LT01, LT12 and LT13 active. Extend that
list only with corpus tests showing safe diagnostics and idempotent fixes.
Statements elsewhere in the same document continue to receive all enabled checks.

LF, CRLF, and CR line endings are normalized internally for consistent
diagnostics and edit ranges. Generated quick fixes use the document's original
line-ending style; opening or linting a document does not rewrite its line endings.

## Adding a rule

1. Use `.github/ISSUE_TEMPLATE/rule.md` to describe the rule code, antipattern,
   and best practice.
2. Add the implementation under the appropriate rule family in
   `server/src/linter/rules/`. Reuse `RegexRule`, `RegexReplaceRule`, or
   `ParserRule` from `base.ts`, or the structural source helpers where appropriate.
3. Register the class in that family's `rules.ts`. The central `ruleRegistry`
   in `server/src/linter/rules/rules.ts` assembles the families; each rule code
   must be unique.
   For configurable rules, declare option types, enums, and defaults in
   `server/src/ruleOptions.ts` and add the rule code to `ruleOptionSchemas`.
   Mirror that declaration in the manifest's explicit rule property, excluding
   the code from the generic rule pattern. The schema alignment test guards
   against drift. Capitalisation rules can reuse `CapitalisationRule` and the
   shared policy declaration.
4. Add tests under `server/src/tests/linter/rules/`. Cover compliant and
   noncompliant SQL, comments and literals, settings and suppression, nested
   queries, and exact diagnostic ranges. For fixes, test edit application,
   idempotence, line endings, and interactions with formatting and Fix All.
5. Create the rule documentation using `docs/rule_template.rst`, add it to
   `docs/source/rules/index.rst`, and update `CHANGELOG.md`.
6. Run the relevant tests and the checks above, preserving the branch-coverage
   threshold and existing behavior.

## Documentation

Documentation uses Python 3.13 or newer and the stable Sphinx and theme versions
pinned in `docs/requirements.txt`.

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r docs/requirements.txt
make docs
```

The generated directory-style HTML is in `docs/build/dirhtml/`. Keep user
configuration and rule reference pages in `docs/source/` up to date.
