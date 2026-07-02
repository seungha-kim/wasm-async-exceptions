import { test, expect } from '@playwright/test';

test('Ep/S3: coroutine await rejects — observed console sequence', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log') lines.push(msg.text());
  });
  page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:8080/examples/Ep/s3/build/index.html');
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('S3:before-suspend'),
    null,
    { timeout: 10_000 }
  );
  await page.evaluate(() => (window as any).__Controlled.reject('s3-1', new Error('S3')));
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s3-done'),
    null,
    { timeout: 10_000 }
  );

  expect(lines.join('\n')).toMatchSnapshot('Ep-S3-console.txt');
});
