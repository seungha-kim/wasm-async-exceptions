import { test, expect } from '@playwright/test';

test('Ep/S1: synchronous throw — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/Ep/s1/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s1-done'),
    null,
    { timeout: 10_000 }
  );

  expect(lines).toEqual([
    'S1:before-throw',
    'PASS:s1-catch-reached',
    'S1',
    'PASS:s1-done',
  ]);
});
