import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('D/S11: nested exception_ptr crosses suspend before nested rethrow — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'D',
    's11',
    [
      { waitForLog: 'S11:before-first-suspend', resolveId: 's11-1' },
      { waitForLog: 'S11:before-second-suspend', resolveId: 's11-2' },
    ],
    'PASS:s11-done',
    'D-S11-console.txt'
  );
});
