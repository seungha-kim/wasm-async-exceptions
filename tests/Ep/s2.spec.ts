import { test, expect } from '@playwright/test';

test('Ep/S2: coroutine await then throw — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/Ep/s2/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S2:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.evaluate(() => (window as any).__Controlled.resolve('s2-1'));
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s2-done'),
    null,
    { timeout: 10_000 }
  );

  expect(lines.join('\n')).toMatchSnapshot('Ep-S2-console.txt');
});
