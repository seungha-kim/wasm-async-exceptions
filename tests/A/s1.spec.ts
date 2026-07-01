import { test, expect } from '@playwright/test';

test('A/S1: synchronous throw is caught by main', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => lines.push(msg.text()));

  await page.goto('http://localhost:8080/A/s1/build/index.html');
  // Give the Wasm scenario time to flush all four console.log lines.
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