const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function duplicationPercentage(statistics) {
  if (!Number.isFinite(statistics.tokens) || !Number.isFinite(statistics.duplicatedTokens)) {
    throw new Error('JSCPD did not report valid token statistics');
  }
  return statistics.tokens === 0 ? 0 : statistics.duplicatedTokens / statistics.tokens * 100;
}

function checkDuplication(base, head, threshold) {
  const baseline = duplicationPercentage(base);
  const current = duplicationPercentage(head);
  const limit = Math.max(threshold, baseline);
  if (current > limit) {
    throw new Error(`Duplication increased to ${current.toFixed(2)}% (base ${baseline.toFixed(2)}%, target ${threshold}%)`);
  }
  return `Duplication ${current.toFixed(2)}% (base ${baseline.toFixed(2)}%, target ${threshold}%): no regression.`;
}

function git(args) {
  return execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
}

function scanSnapshot(ref, files, directory, config) {
  fs.mkdirSync(directory);
  for (const file of files) {
    if (git(['ls-tree', '-z', ref, '--', file]).length === 0) {
      continue;
    }
    const target = path.join(directory, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, git(['show', `${ref}:${file}`]));
  }
  fs.copyFileSync(path.resolve('biome.json'), path.join(directory, 'biome.json'));
  execFileSync('npx', [
    '--yes', '@biomejs/biome@2.6.2', 'format', '--write', '--vcs-enabled=false',
  ], { cwd: directory, stdio: 'inherit' });
  const output = `${directory}-report`;
  execFileSync('npx', [
    '--yes', 'jscpd@5.3.0', '--config', config, '--reporters', 'json',
    '--output', output, '--threshold', '100', directory,
  ], { stdio: 'inherit' });
  return JSON.parse(fs.readFileSync(path.join(output, 'jscpd-report.json'), 'utf8')).statistics.total;
}

function main() {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) {
    throw new Error('Usage: node scripts/check-duplication.cjs BASE_SHA HEAD_SHA');
  }
  git(['rev-parse', '--verify', `${base}^{commit}`]);
  git(['rev-parse', '--verify', `${head}^{commit}`]);
  const files = git(['diff', '--name-only', '-z', '--diff-filter=ACMR', base, head])
    .toString().split('\0').filter(Boolean);
  if (files.length === 0) {
    console.log('No changed files to check for duplication.');
    return;
  }
  const config = path.resolve('.github/linters/.jscpd.json');
  const { threshold } = JSON.parse(fs.readFileSync(config, 'utf8'));
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bqsql-duplication-'));
  try {
    const baseline = scanSnapshot(base, files, path.join(temporary, 'base'), config);
    const current = scanSnapshot(head, files, path.join(temporary, 'head'), config);
    console.log(checkDuplication(baseline, current, threshold));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

module.exports = { checkDuplication };
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
