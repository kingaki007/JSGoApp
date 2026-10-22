/** Verifies plan membership, independent switches, and future account subscription fallbacks. */
import { describe, expect, it } from 'vitest';
import {
  featurePolicy,
  resolveFeatureAccess,
  resolveSubscriptionTier,
  type AccessSubject,
  type SubscriptionTier,
  type UserSubscription,
} from '../src/features';

const now = Date.parse('2026-10-22T12:00:00Z');

/** @param subscription Server-owned subscription or null for an account without a subscription. */
function account(subscription: UserSubscription | null): AccessSubject {
  return { kind: 'authenticated', user: { id: 'user-123', subscription } };
}

/** @param tier Plan granted by a future account service. */
function activeAccount(tier: SubscriptionTier): AccessSubject {
  return account({ tier, status: 'active', expiresAt: null });
}

describe('subscription feature policy', () => {
  it('keeps all three features active for anonymous users by default', () => {
    expect(resolveFeatureAccess()).toEqual({
      definitionNavigation: true,
      autocomplete: true,
      hoverDocumentation: true,
    });
  });

  it.each([
    ['free', false, false, false],
    ['plus', false, true, true],
    ['max', true, true, true],
  ] as const)(
    'grants the configured %s plan',
    (tier, definitionNavigation, autocomplete, hoverDocumentation) => {
      expect(resolveFeatureAccess(activeAccount(tier))).toEqual({
        definitionNavigation,
        autocomplete,
        hoverDocumentation,
      });
    },
  );

  it('changes plan membership by feature name without affecting other plans', () => {
    const policy = structuredClone(featurePolicy);
    policy.plans.free = ['autocomplete'];
    policy.plans.plus = ['definitionNavigation'];
    expect(resolveFeatureAccess(activeAccount('free'), policy).autocomplete).toBe(true);
    expect(resolveFeatureAccess(activeAccount('plus'), policy)).toEqual({
      definitionNavigation: true,
      autocomplete: false,
      hoverDocumentation: false,
    });
    expect(resolveFeatureAccess(activeAccount('max'), policy).autocomplete).toBe(true);
  });

  it('bypasses plan restrictions while preserving global feature off switches', () => {
    const policy = structuredClone(featurePolicy);
    policy.paywallEnabled = false;
    policy.features.autocomplete.enabled = false;
    expect(resolveFeatureAccess(activeAccount('free'), policy)).toEqual({
      definitionNavigation: true,
      autocomplete: false,
      hoverDocumentation: true,
    });
    expect(resolveFeatureAccess(activeAccount('max'), policy).autocomplete).toBe(false);
  });

  it('allows changing anonymous access without changing authenticated account grants', () => {
    const policy = { ...featurePolicy, anonymousTier: 'free' as const };
    expect(resolveFeatureAccess({ kind: 'anonymous' }, policy).definitionNavigation).toBe(false);
    expect(resolveFeatureAccess(activeAccount('max'), policy).definitionNavigation).toBe(true);
    expect(resolveSubscriptionTier(account(null))).toBe('free');
  });

  it.each(['active', 'trialing'] as const)('accepts an unexpired %s subscription', (status) => {
    expect(
      resolveSubscriptionTier(
        account({ tier: 'max', status, expiresAt: '2026-11-01T00:00:00Z' }),
        featurePolicy,
        now,
      ),
    ).toBe('max');
  });

  it.each([
    { tier: 'max', status: 'inactive', expiresAt: null },
    { tier: 'max', status: 'active', expiresAt: '2026-10-22T12:00:00Z' },
    { tier: 'max', status: 'active', expiresAt: '2026-10-21T00:00:00Z' },
    { tier: 'max', status: 'active', expiresAt: 'invalid' },
    { tier: 'unknown', status: 'active', expiresAt: null },
    { tier: 'max', status: 'unknown', expiresAt: null },
  ])('falls back to Free for an invalid or inactive subscription: %j', (subscription) => {
    expect(
      resolveSubscriptionTier(account(subscription as UserSubscription), featurePolicy, now),
    ).toBe('free');
  });
});
