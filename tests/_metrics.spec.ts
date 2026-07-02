import { test } from '@playwright/test';

type Target = 'A' | 'B' | 'C' | 'D' | 'E' | 'Ep';
type Scenario = 's1' | 's2' | 's3' | 's4';

interface MetricRow {
  target: Target;
  scenario: Scenario;
  elapsedMs: number;
  outcome: string;
  pageerror: string;
}

const targets: Target[] = ['A', 'B', 'C', 'D', 'E', 'Ep'];
const scenarios: Scenario[] = ['s1', 's2', 's3', 's4'];

const doneMarker: Record<Scenario, string> = {
  s1: 'PASS:s1-done',
  s2: 'PASS:s2-done',
  s3: 'PASS:s3-done',
  s4: 'PASS:s4-done',
};

function displayTarget(target: Target): string {
  return target === 'Ep' ? "E'" : target;
}

function firstErrorText(error: string): string {
  return error.split('\n')[0].replace(/\|/g, '\\|');
}

async function settleScenario(page: any, scenario: Scenario, controlErrors: string[]) {
  if (scenario === 's1') return;

  const upper = scenario.toUpperCase();
  await page.waitForFunction(
    (marker: string) => (window as any).__logLines?.includes(marker),
    `${upper}:before-suspend`,
    { timeout: 10_000 }
  );

  if (scenario === 's2') {
    const resolveResult = await page.evaluate(() => {
      try {
        (window as any).__Controlled.resolve('s2-1');
        return 'resolved';
      } catch (e) {
        return `[control-error] ${e instanceof Error ? e.message : String(e)}`;
      }
    });
    if (resolveResult !== 'resolved') controlErrors.push(resolveResult);
    return;
  }

  if (scenario === 's3') {
    const rejectResult = await page.evaluate(() => {
      try {
        (window as any).__Controlled.reject('s3-1', new Error('S3'));
        return 'rejected';
      } catch (e) {
        return `[control-error] ${e instanceof Error ? e.message : String(e)}`;
      }
    });
    if (rejectResult !== 'rejected') controlErrors.push(rejectResult);
    return;
  }

  const rejectResult = await page.evaluate(() => {
    try {
      (window as any).__Controlled.reject('s4-1', new Error('S4'));
      return 'rejected';
    } catch (e) {
      return `[control-error] ${e instanceof Error ? e.message : String(e)}`;
    }
  });
  if (rejectResult !== 'rejected') controlErrors.push(rejectResult);
  await page.waitForFunction(
    () => (window as any).__logLines?.includes('PASS:s4-catch-reached'),
    null,
    { timeout: 2_000 }
  ).catch(() => {});

  const resolveResult = await page.evaluate(() => {
    try {
      (window as any).__Controlled.resolve('s4-2');
      return 'resolved';
    } catch (e) {
      return `[control-error] ${e instanceof Error ? e.message : String(e)}`;
    }
  });
  if (resolveResult !== 'resolved') controlErrors.push(resolveResult);
}

test.describe.configure({ mode: 'serial' });

test('metrics: load-to-completion timing and error surface', async ({ browser }) => {
  test.setTimeout(120_000);

  const rows: MetricRow[] = [];

  for (const target of targets) {
    for (const scenario of scenarios) {
      const page = await browser.newPage();
      const lines: string[] = [];
      const pageerrors: string[] = [];
      const controlErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'log') lines.push(msg.text());
      });
      page.on('pageerror', (e) => pageerrors.push(e.message));

      const started = Date.now();
      await page.goto(`http://localhost:8080/examples/${target}/${scenario}/build/index.html`);
      await settleScenario(page, scenario, controlErrors);

      await page.waitForFunction(
        (marker: string) => (window as any).__logLines?.includes(marker),
        doneMarker[scenario],
        { timeout: 2_000 }
      ).catch(() => {});

      const elapsedMs = Date.now() - started;
      const hasDone = lines.includes(doneMarker[scenario]);
      const outcome = hasDone ? 'done' : 'observed failure/timeout';
      const pageerror = firstErrorText(pageerrors[0] ?? controlErrors[0] ?? '');

      rows.push({ target, scenario, elapsedMs, outcome, pageerror });
      await page.close();
    }
  }

  process.stdout.write('\n## Timing Metrics\n\n');
  process.stdout.write('| Target | Scenario | Elapsed ms | Outcome | Error surface |\n');
  process.stdout.write('|---|---:|---:|---|---|\n');
  for (const row of rows) {
    process.stdout.write(
      `| ${displayTarget(row.target)} | ${row.scenario.slice(1)} | ${row.elapsedMs} | ${row.outcome} | ${row.pageerror || '-'} |\n`
    );
  }
  process.stdout.write('\n');
});
