import { test, expect } from '@playwright/test';

test('C/S1: synchronous throw is caught by main (JSPI baseline)', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/C/s1/build/index.html');
  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s1-done'),
      null,
      { timeout: 2_000 }
    ).catch(() => lines.push('[timeout] no s1-done')),
    page.waitForTimeout(2_000).then(() => lines.push('[timeout] no s1-done')),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('C-S1-console.txt');
});
