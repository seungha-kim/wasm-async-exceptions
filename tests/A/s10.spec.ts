import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('A/S10: destructor helper suspends during unwind — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'A',
    's10',
    [
      { waitForLog: 'S10:before-work-suspend', resolveId: 's10-work' },
      { waitForLog: 'S10:helper-before-suspend', resolveId: 's10-cleanup' },
    ],
    'PASS:s10-done',
    'A-S10-console.txt'
  );
});
