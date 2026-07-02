import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('npm test rebuilds ignored example artifacts before running Playwright', () => {
  const packageJson = JSON.parse(read('package.json')) as {
    scripts?: Record<string, string>;
  };

  expect(packageJson.scripts?.['build:examples']).toBe('scripts/build-all-examples.sh');
  expect(packageJson.scripts?.test).toBe('npm run build:examples && playwright test --workers=1');
});

test('toolchain script installs and activates the pinned emsdk tag', () => {
  const script = read('scripts/toolchain.sh');

  expect(script).toContain('"$EMSDK_DIR/emsdk" install "$EMSDK_TAG"');
  expect(script).toContain('"$EMSDK_DIR/emsdk" activate "$EMSDK_TAG"');
  expect(script).not.toContain(' install latest');
  expect(script).not.toContain(' activate latest');
});

test('README quick start keeps subsequent commands at the repository root', () => {
  const readme = read('README.md');

  expect(readme).toContain('source ./emsdk/emsdk_env.sh');
  expect(readme).toContain('(cd examples/A/s3 && ./run.sh)');
  expect(readme).not.toContain('cd examples/A/s3 && ./build.sh && ./run.sh');
});

test('documentation does not overstate JSPI plus Wasm EH as a complete fix', () => {
  const readme = read('README.md');
  const design = read('docs/design.md');

  expect(readme).not.toContain('JSPI + Wasm exception handling** 조합이 이를 어떻게 해소');
  expect(readme).not.toContain('| D | JSPI | Wasm EH | 런타임 표준 둘 다 → 충돌 해소 |');
  expect(design).not.toContain('충돌 세 가지가 모두 *구조적으로* 소거');
});
