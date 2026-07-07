import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('A/S8: multi-yield call chain throws to outer catch — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'A',
    's8',
    [
      { waitForLog: 'S8:l1-before-suspend', resolveId: 's8-l1' },
      { waitForLog: 'S8:l2-before-suspend', resolveId: 's8-l2' },
      { waitForLog: 'S8:l3-before-suspend', resolveId: 's8-l3' },
    ],
    'PASS:s8-done',
    'A-S8-console.txt'
  );
});
