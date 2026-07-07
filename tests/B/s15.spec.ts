import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('B/S15: stable what pointer crosses suspend — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'B',
    's15',
    [
      { waitForLog: 'S15:before-first-suspend', resolveId: 's15-1' },
      { waitForLog: 'S15:before-second-suspend', resolveId: 's15-2' },
    ],
    'PASS:s15-done',
    'B-S15-console.txt'
  );
});
