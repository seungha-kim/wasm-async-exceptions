import { test } from '@playwright/test';
import { runResolveOnlyScenario } from '../_resolve_scenarios';

test('B/S17: exception_ptr created after resume is rethrown before another suspend — observed console sequence', async ({ page }) => {
  await runResolveOnlyScenario(
    page,
    'B',
    's17',
    [{ waitForLog: 'S17:before-suspend', resolveId: 's17-1' }],
    'PASS:s17-done',
    'B-S17-console.txt'
  );
});
