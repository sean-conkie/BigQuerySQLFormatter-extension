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

`npm test` runs server and BigQuery client unit tests after compilation. `npm run coverage` also
generates `coverage/lcov.info` and fails if overall branch coverage falls below
80%. CI uploads coverage to Codecov using `CODECOV_TOKEN`. Fork pull requests use
public-repository tokenless uploads; configure the token as a Dependabot secret
as well to enable uploads from Dependabot PRs.

Regression tests cover multiline incremental edits and CRLF, directive edge
cases, diagnostic limits, and overlapping fix-all edits while preserving
individual quick fixes.

Filesystem-backed server suites allow 15 seconds for tests and hooks. Temporary
directory cleanup awaits pending creation, including when setup times out.

### Extended query coverage

Pipe syntax (including FROM-only queries) and `FOR SYSTEM_TIME AS OF` have
source and scope models. `StatementAST.pipeInput` exposes input sources;
`pipeClauses` holds typed projections, grouping items, conditions, column
transformations, aliases, joins/TVFs, ordering/limits, set operands, pivot/unpivot,
sampling and windows. `pipeStages` retains highlighting tokens and nesting depths.
Child queries are modelled recursively through `queryBlocks`, with original ranges.
Incremental edits rebuild these models.

The scope resolver exposes a `QueryScope` for each stage's input: JOIN adds a
source; SELECT/AGGREGATE, CALL and set operations replace the table; AS replaces
range variables; EXTEND preserves existing sources and adds visible output names.
SET, DROP, RENAME and DISTINCT preserve original range variables. Temporal
modifiers do not hide the source or its alias. No table schema is inferred.

RF01-RF06, AL01, AL02, AL04, AL05, AL06, AL08, AL09, AM04, AM05, AM06 and AM07
opt into this model through `pipeQueryRules`. RF01 still requires explicit enabling.
Operators without an equivalent for a rule are not applicable (for example,
AL01 must not remove the mandatory AS in `|> AS`, and AM04 ignores multiplication
and COUNT(\*)). Other LT and ST rules remain gated pending a pipe layout policy.

MATCH_RECOGNIZE, GRAPH_TABLE and unmodelled pipe operators (including pipe WITH)
still skip their own query block and its descendants, not enclosing traditional
queries or sibling CTEs/subqueries. `hasExtendedQuerySyntax` identifies the current
block's extended syntax; `hasUnsupportedQuerySyntax` distinguishes syntax still
unsupported by the phase 2 rules. A scope statement reports `unsupported` if any
of its blocks is unsupported, but supported sibling/enclosing scopes remain available.

CP01-CP05, CV01, CV02, CV04, CV05, CV13, LT01, LT12 and LT13 remain safe even
inside unsupported blocks through `extendedQuerySafeRules`. Add rules to either
allow-list only with corpus tests for exact diagnostics, safe quick fixes,
Fix All and idempotent formatting. Non-opted-in fixes cannot cross protected
query ranges, including nested blocks.

Mixed-query regression tests cover AST, source-based and regular expression rules, opaque
projection counts, incomplete queries, incremental edits, protected fix ranges,
and idempotent formatting/Fix All with LF, CRLF and CR line endings.

`npm run citest` runs server tests followed by client end-to-end tests. These
download and launch Visual Studio Code and require a display. On headless Linux:

```sh
xvfb-run -a npm run citest
```

### BigQuery foundation tests

The client-only BigQuery runtime is a separate `dist/bigquery.js` bundle.
Offline unit tests use `client/src/test/bigquery/mockServer.ts` for dry runs,
dataset/table metadata, authentication failures, rate limits, network failures,
timeouts, optional quota headers, quota/location errors and proxy routing.
Fixtures also include SELECT/SCRIPT responses, pagination and nested RECORD
fields with omitted mode. A unit guard forbids global `fetch` in the BigQuery
source and checks the Node-20-compatible auth majors and Dependabot ignores.
CI never uses Google or real credentials.
`BQSQL_TEST_BIGQUERY_ENDPOINT` accepts only loopback HTTP URLs and switches the
runtime to synthetic credentials; it is not a Visual Studio Code setting.

Run the focused tests after compilation:

```sh
npx --no-install mocha client/out/test/bigquery/unit.test.js server/out/tests/projectSettings.test.js
node client/out/test/runTest
BQSQL_TEST_UNTRUSTED=1 node client/out/test/runTest
```

Extension-host tests exercise lazy loading, the real settings/consent adapter,
mock REST requests and cancellation. The untrusted run also verifies that
linting still works and that user opt-ins cannot bypass workspace trust.
Activation-to-language-server-readiness timing is printed by the test helper.

The spike verified ADC user/key-file/impersonated credentials, token refresh,
automatic location selection and Visual Studio Code proxy routing on 1.91 and 1.144.
Remaining manual checks include workload identity and a controlled
TLS-intercepting proxy with `http.proxyStrictSSL: false` (restore certificate
verification afterwards). Confirm optional quota-project permissions, project/location
consent changes and reset cancellation, and inspect the BigQuery output channel
for metadata only. Do not retain query text, schema contents or tokens in reports.

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

The extension exports `ready(): Promise<void>`, resolved by the server's
`bigquerySQLFormatter/ready` notification after loading the GoogleSQL grammar and
Oniguruma Wasm. The end-to-end helper awaits this API before opening documents. A root
suite hook opens a fixture and awaits its first diagnostics before assertions.
Neither language-server startup nor warm-up uses fixed sleeps.

Cold-start readiness and the first validation share a 60-second budget, configurable
with `BQSQL_TEST_COLD_START_TIMEOUT_MS`. Subsequent diagnostic waits default to
15 seconds, configurable independently with `BQSQL_TEST_TIMEOUT_MS`. Both accept
positive integer milliseconds. Mocha allows at least 100 seconds per test/hook
and increases its timeout for larger overrides.

Diagnostic timeouts report phase duration, time since activation, document/settings
state and the last 80 server output lines. Tests enable server message tracing in
their isolated profile. On failure the runner copies full Visual Studio Code logs (including
extension-host and language-server output) to `.vscode-test/logs` before removing
the temporary profile. Set `BQSQL_TEST_LOG_DIR` to retain logs elsewhere. CI uploads
these logs as an `e2e-logs-*` artifact. Tests do not automatically retry.

To check macOS cold-start stability, manually run the **Node.js Test** workflow
on the branch under test with **macos-stability** enabled. This runs 20 separate
macOS stable packaging/end-to-end jobs sequentially, with fresh profiles and no retries.
Link the workflow run in the PR and confirm all 20 jobs pass before claiming
stability verification.

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

## Refreshing keyword data

Run `npm run generate:keywords` with network access to refresh
`server/src/linter/keywords.json`. Reserved words come only from the
[official GoogleSQL lexical reserved keywords table](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/lexical#reserved_keywords),
not from syntax highlighting. Non-reserved words are the literal words in
`keyword.*` and `storage.type.sql` grammar scopes (including scoped captures,
begin/end patterns, and multi-word phrases), excluding the reserved set.
Type names such as `date`, `timestamp`, `json` and `int64` are included for RF04.
Function scopes do not independently contribute keywords.

The committed catalog contains sorted, unique lowercase `reserved` and
`nonReserved` arrays, without timestamps. Generation does not modify the grammar.
Commit refreshed keyword data with any grammar change that affects keyword
scopes; do not edit the catalog by hand. Builds and tests consume committed data
without accessing the network.

Run `node --test scripts/generate-keywords.test.cjs` after regenerating. These
offline tests compare the entire reserved list against the documented table
fixture in `scripts/fixtures/reserved-keywords.html`, validate grammar
synchronization, and check deterministic output and extraction failures. If the
upstream table or supported grammar expression syntax changes, update extraction
and fixtures deliberately rather than accepting partial data.

## Query scope resolution

`server/src/linter/scope.ts` provides source-level query scopes for reference
rules: sources and aliases, CTE visibility, select aliases, JOIN USING columns,
and parent links for correlated subqueries. Scope token indices are half-open
intervals into the resolver's input tokens. Resolve dotted references through
`classifyReference`; an unknown first component is STRUCT field access, not an
assumed table qualifier. No database schema or column existence is inferred.

See [Extended query coverage](#extended-query-coverage) for stage visibility and
unsupported-block handling. AL04 and AL05 retain compatibility adapters for
traditional AST coverage, case comparisons and ranges; extended aliasing uses
stage-local scopes and output lists. AM06 uses query scope clauses; CP02 uses
the shared lexical identifier roles.

`server/src/linter/joins.ts` supplements query scopes with JOIN ON ranges,
ordered boolean terms, explicit parenthesis groups and comparison operands.
ST09 and LT90 share this model; comparisons expose their source references
without inferring schemas or moving correlated/ambiguous expressions.

## Rule codes

Use SQLFluff-compatible codes and names where an equivalent rule exists.
Codes **90-99 in each group** are reserved for project-specific rules so they
cannot collide with SQLFluff rules. For example, LT90
(`layout.join_condition_parentheses`) is an opt-in project-specific style.
Do not use LT14 for this rule: LT14 is SQLFluff's `layout.keyword_newline`.

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
