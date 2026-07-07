import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('D/S10: destructor helper suspends during unwind — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'D',
    's10',
    [
      { waitForLog: 'S10:before-work-suspend', resolveId: 's10-work' },
      { waitForLog: 'S10:helper-before-suspend', resolveId: 's10-cleanup' },
    ],
    'PASS:s10-done',
    'D-S10-console.txt'
  );
});
