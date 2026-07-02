import { test, expect } from '@playwright/test';

test('B/S4: catch then re-suspend — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/B/s4/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S4:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);

  await page.evaluate(() => (window as any).__Controlled.reject('s4-1', new Error('S4')));
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s4-catch-reached'),
    null,
    { timeout: 10_000 }
  ).catch(() => {/* catch-miss case will be visible in the snapshot */});

  await page.evaluate(() => {
    try {
      (window as any).__Controlled.resolve('s4-2');
      return 'resolved';
    } catch {
      return 'no-s4-2-registered';
    }
  });

  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s4-done'),
      null,
      { timeout: 5_000 }
    ).catch(() => {/* not reached for this pitfall case */}),
    page.waitForTimeout(2_000),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('B-S4-console.txt');
});