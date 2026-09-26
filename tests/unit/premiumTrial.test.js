import { describe, it, expect, afterEach } from 'vitest';
import { isLaunchTrialActive } from '@/lib/premiumTrial';

const ENV_KEY = 'NEXT_PUBLIC_PREMIUM_TRIAL_ENDS_AT';

describe('isLaunchTrialActive', () => {
  afterEach(() => { delete process.env[ENV_KEY]; });

  it('is active when the env var is unset (safe default, not yet launched)', () => {
    delete process.env[ENV_KEY];
    expect(isLaunchTrialActive()).toBe(true);
  });

  it('is active when the cutoff date is in the future', () => {
    process.env[ENV_KEY] = new Date(Date.now() + 60_000).toISOString();
    expect(isLaunchTrialActive()).toBe(true);
  });

  it('is inactive when the cutoff date is in the past', () => {
    process.env[ENV_KEY] = new Date(Date.now() - 60_000).toISOString();
    expect(isLaunchTrialActive()).toBe(false);
  });
});
