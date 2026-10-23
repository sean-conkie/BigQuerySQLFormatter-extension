const { build, context } = require('esbuild');
const { copyFileSync, mkdirSync, readFileSync, rmSync } = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const watch = process.argv.includes('--watch');
const wasm = require.resolve('vscode-oniguruma/release/onig.wasm', {
  paths: [path.join(root, 'server')],
});

function copyAssets() {
  for (const directory of ['dist', 'server/out/linter']) {
    mkdirSync(path.join(root, directory), { recursive: true });
    copyFileSync(wasm, path.join(root, directory, 'onig.wasm'));
  }
  mkdirSync(path.join(root, 'dist/syntaxes'), { recursive: true });
  copyFileSync(
    path.join(root, 'server/src/linter/syntaxes/googlesql.tmLanguage.json'),
    path.join(root, 'dist/syntaxes/googlesql.tmLanguage.json'),
  );
}

async function main() {
  copyAssets();
  const options = {
    absWorkingDir: root,
    entryPoints: {
      extension: 'client/src/extension.ts',
      server: 'server/src/server.ts',
    },
    outdir: 'dist',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node16',
    external: ['vscode'],
    sourcemap: watch,
    logLevel: 'info',
    plugins: [{
      name: 'runtime-assets',
      setup(build) {
        build.onLoad({ filter: /[/\\]grammarLoader\.ts$/ }, (args) => ({
          contents: readFileSync(args.path, 'utf8'),
          loader: 'ts',
          watchFiles: [wasm, path.join(root, 'server/src/linter/syntaxes/googlesql.tmLanguage.json')],
        }));
        build.onEnd((result) => {
          if (result.errors.length === 0) copyAssets();
        });
      },
    }],
  };
  if (!watch) {
    for (const entry of Object.keys(options.entryPoints)) {
      rmSync(path.join(root, 'dist', `${entry}.js.map`), { force: true });
    }
    await build(options);
    return;
  }

  const bundler = await context(options);
  await bundler.watch();
  const typecheck = spawn(process.execPath, [require.resolve('typescript/bin/tsc'), '-b', '-w'], {
    cwd: root,
    stdio: 'inherit',
  });
  typecheck.on('error', async (error) => {
    console.error(error);
    process.exitCode = 1;
    await bundler.dispose();
  });
  typecheck.on('exit', async (code) => {
    await bundler.dispose();
    process.exitCode = code ?? 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => typecheck.kill(signal));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
