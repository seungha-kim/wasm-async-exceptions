import { test, expect } from '@playwright/test';

test('A/S2: suspend then throw — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });

  await page.goto('http://localhost:8080/examples/A/s2/build/index.html');
  // Wasm suspends at await_controlled_promise("s2-1"). Give it a moment to
  // print the "before-suspend" line and reach the suspend point.
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S2:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  // Let the Wasm frame actually suspend first (Asyncify yields back to JS).
  await page.waitForTimeout(50);
  // Drive the Promise resolution; this unpauses Wasm.
  await page.evaluate(() => (window as any).__Controlled.resolve('s2-1'));
  // Wait for either the "done" sentinel or an uncaught JS page error.
  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s2-done'),
      null,
      { timeout: 10_000 }
    ),
    page.waitForEvent('pageerror', { timeout: 10_000 }).then((e) => {
      lines.push(`[pageerror] ${e.message}`);
    }),
    page.waitForTimeout(10_000).then(() => lines.push('[timeout] no s2-done')),
  ]);

  // Snapshot for matrix.md. We do NOT assert an exact sequence here because
  // this scenario is exactly where we expect a pitfall to manifest; the
  // matrix will record whatever this turns out to be.
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('A-S2-console.txt');
});