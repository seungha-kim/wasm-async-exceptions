import { test, expect } from '@playwright/test';

test('C/S4: catch then re-suspend — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/C/s4/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S4:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);

  const rejectResult = await page.evaluate(() => {
    try {
      (window as any).__Controlled.reject('s4-1', new Error('S4'));
      return 'rejected';
    } catch (e) {
      return `[control-error] ${e instanceof Error ? e.message : String(e)}`;
    }
  });
  if (rejectResult !== 'rejected') lines.push(rejectResult);
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s4-catch-reached'),
    null,
    { timeout: 10_000 }
  ).catch(() => {/* catch-miss case visible in snapshot */});

  await page.evaluate(() => {
    try {
      (window as any).__Controlled.resolve('s4-2');
      return 'resolved';
    } catch {
      return 'no-s4-2-registered';
    }
  });

  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s4-done'),
    null,
    { timeout: 2_000 }
  ).catch(() => {/* not reached for this pitfall case */});

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('C-S4-console.txt');
});
