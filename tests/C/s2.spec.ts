import { test, expect } from '@playwright/test';

test('C/S2: suspend then throw — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/C/s2/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S2:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);
  const resolveResult = await page.evaluate(() => {
    try {
      (window as any).__Controlled.resolve('s2-1');
      return 'resolved';
    } catch (e) {
      return `[control-error] ${e instanceof Error ? e.message : String(e)}`;
    }
  });
  if (resolveResult !== 'resolved') lines.push(resolveResult);
  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s2-done'),
      null,
      { timeout: 10_000 }
    ),
    page.waitForTimeout(5_000).then(() => lines.push('[timeout] no s2-done')),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('C-S2-console.txt');
});
