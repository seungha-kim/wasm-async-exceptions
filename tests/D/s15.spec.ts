import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('D/S15: stable what pointer crosses suspend — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'D',
    's15',
    [
      { waitForLog: 'S15:before-first-suspend', resolveId: 's15-1' },
      { waitForLog: 'S15:before-second-suspend', resolveId: 's15-2' },
    ],
    'PASS:s15-done',
    'D-S15-console.txt'
  );
});
