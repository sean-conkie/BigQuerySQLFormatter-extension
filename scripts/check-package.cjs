const assert = require('node:assert/strict');
const path = require('node:path');
const { listFiles, PackageManager } = require('@vscode/vsce');

async function main() {
  const files = await listFiles({
    cwd: path.resolve(__dirname, '..'),
    packageManager: PackageManager.None,
  });
  const forbidden = /^(?:docs|\.github|\.devcontainer|\.venv|\.vscode-test|scripts)\//;
  const developmentFiles = files.filter(file =>
    forbidden.test(file) ||
    /(?:^|\/)node_modules\//.test(file) ||
    /(?:^|\/)out\/tests?\//.test(file) ||
    /^(?:Makefile|biome\.json|\.readthedocs\.yml|\.shellcheckrc|\.vscode-test\.js|\.markdownlintignore|\.git-blame-ignore-revs)$/.test(file) ||
    /\.(?:sql|ts|map|tsbuildinfo|code-workspace)$/.test(file)
  );
  assert.deepEqual(developmentFiles, [], 'Development files must not be shipped in the VSIX');
  for (const required of [
    'CHANGELOG.md',
    'dist/extension.js',
    'dist/server.js',
    'dist/syntaxes/googlesql.tmLanguage.json',
    'dist/onig.wasm',
    'images/BigQuerySQLFormatter_transparent_128.png',
    'language-configuration.json',
  ]) {
    assert(files.includes(required), `Missing runtime file: ${required}`);
  }
  console.log(`Verified ${files.length} packaged files: no development content and all required runtime assets present.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
