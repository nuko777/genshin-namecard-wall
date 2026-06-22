const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const esbuild = require('esbuild');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const cache = new Map();

async function loadTsUtils(entry) {
  const entryPath = path.join(REPO_ROOT, entry);
  if (cache.has(entryPath)) return cache.get(entryPath);

  const outfile = path.join(os.tmpdir(), `genshin-utils-${process.pid}-${Date.now()}-${cache.size}.cjs`);
  await esbuild.build({
    entryPoints: [entryPath],
    outfile,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    logLevel: 'silent',
  });

  const loaded = import(pathToFileURL(outfile).href).finally(() => {
    fs.rmSync(outfile, { force: true });
  });
  cache.set(entryPath, loaded);
  return loaded;
}

module.exports = { loadTsUtils, REPO_ROOT };
