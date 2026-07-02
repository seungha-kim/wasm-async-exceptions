import { test, expect } from '@playwright/test';

test('C/S3: suspended Promise rejects — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/C/s3/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S3:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(50);
  const rejectResult = await page.evaluate(() => {
    try {
      (window as any).__Controlled.reject('s3-1', new Error('S3'));
      return 'rejected';
    } catch (e) {
      return `[control-error] ${e instanceof Error ? e.message : String(e)}`;
    }
  });
  if (rejectResult !== 'rejected') lines.push(rejectResult);
  await Promise.race([
    page.waitForFunction(
      () => (window as any).__logLines?.includes('PASS:s3-done') ||
             (window as any).__logLines?.includes('PASS:s3-catch-reached-ellipsis'),
      null,
      { timeout: 2_000 }
    ).catch(() => lines.push('[timeout] no s3-done')),
  ]);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).toMatchSnapshot('C-S3-console.txt');
});
