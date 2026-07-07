import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('B/S12: exception_ptr survives suspend before rethrow_exception — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'B',
    's12',
    [
      { waitForLog: 'S12:before-first-suspend', resolveId: 's12-1' },
      { waitForLog: 'S12:before-second-suspend', resolveId: 's12-2' },
    ],
    'PASS:s12-done',
    'B-S12-console.txt'
  );
});
