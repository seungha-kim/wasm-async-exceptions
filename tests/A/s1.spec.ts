import { test, expect } from '@playwright/test';

test('A/S1: synchronous throw is caught by main', async ({ page }) => {
  const lines: string[] = [];
  // Only `console.log` (the channel our scenario uses); ignore warnings/errors
  // from missing source maps etc. so the assertion is exactly the scenario
  // output.
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });

  await page.goto('http://localhost:8080/examples/A/s1/build/index.html');
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