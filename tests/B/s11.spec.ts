import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('B/S11: nested exception_ptr crosses suspend before nested rethrow — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'B',
    's11',
    [
      { waitForLog: 'S11:before-first-suspend', resolveId: 's11-1' },
      { waitForLog: 'S11:before-second-suspend', resolveId: 's11-2' },
    ],
    'PASS:s11-done',
    'B-S11-console.txt'
  );
});
