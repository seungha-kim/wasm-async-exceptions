import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('D/S5: C++ throw then suspend inside catch — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'D',
    's5',
    [
      { waitForLog: 'S5:before-first-suspend', resolveId: 's5-1' },
      { waitForLog: 'S5:catch-before-suspend', resolveId: 's5-2' },
    ],
    'PASS:s5-done',
    'D-S5-console.txt'
  );
});
