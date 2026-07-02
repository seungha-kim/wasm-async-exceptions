import { test, expect } from '@playwright/test';

test('B/S1: synchronous throw is caught by main (Wasm EH baseline)', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });

  await page.goto('http://localhost:8080/examples/B/s1/build/index.html');
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