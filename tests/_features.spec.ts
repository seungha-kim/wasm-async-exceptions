import { test, expect } from '@playwright/test';

test('runtime supports Wasm exceptions', async ({ page }) => {
  await page.setContent(`
    <script>
      window.__supportsWasmEH = (typeof WebAssembly.Exception === 'function') &&
        (typeof WebAssembly.Tag === 'function');
    </script>
  `);
  expect(await page.evaluate(() => (window as any).__supportsWasmEH)).toBe(true);
});

test('runtime supports JSPI', async ({ page }) => {
  await page.setContent(`
    <script>
      // WebAssembly.Suspending is the wrapper constructor used to mark JSPI imports.
      // (Older proposals exposed WebAssembly.Suspender; either indicates support.)
      window.__supportsJSPI = (typeof WebAssembly.Suspending === 'function') ||
        (typeof WebAssembly.Suspender === 'function');
    </script>
  `);
  expect(await page.evaluate(() => (window as any).__supportsJSPI)).toBe(true);
});