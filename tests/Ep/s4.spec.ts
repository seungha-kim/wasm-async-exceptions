import { test, expect } from '@playwright/test';

test('Ep/S4: coroutine catch then re-await — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/Ep/s4/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S4:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.evaluate(() => (window as any).__Controlled.reject('s4-1', new Error('S4')));
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s4-catch-reached'),
    null,
    { timeout: 10_000 }
  );
  await page.evaluate(() => (window as any).__Controlled.resolve('s4-2'));
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s4-done'),
    null,
    { timeout: 10_000 }
  );

  expect(lines.join('\n')).toMatchSnapshot('Ep-S4-console.txt');
});
