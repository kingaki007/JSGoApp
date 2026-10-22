/** Defines subscription plans, human-readable feature flags, and shared access decisions. */
export type SubscriptionTier = 'free' | 'plus' | 'max';
/** Stable names are shared by plan lists and editor gates; enabled is the global off switch. */
export const featureCatalog = {
  definitionNavigation: { label: 'Built-in definition navigation', enabled: true },
  autocomplete: { label: 'Autocomplete', enabled: true },
  hoverDocumentation: { label: 'Function signatures and hover documentation', enabled: true },
};
export type Feature = keyof typeof featureCatalog;
export type FeatureAccess = Readonly<Record<Feature, boolean>>;

export interface FeaturePolicy {
  /** False opens all enabled features regardless of subscription. */
  paywallEnabled: boolean;
  /** Temporary access for anonymous visitors; authenticated accounts never use this fallback. */
  anonymousTier: SubscriptionTier;
  features: Record<Feature, { label: string; enabled: boolean }>;
  /** Independent lists: removing a feature from Plus does not change Max. */
  plans: Record<SubscriptionTier, readonly Feature[]>;
}

/** Edit these switches and feature-name lists to change access across web and desktop. */
export const featurePolicy: FeaturePolicy = {
  paywallEnabled: true,
  anonymousTier: 'max',
  features: featureCatalog,
  plans: {
    free: [],
    plus: ['autocomplete', 'hoverDocumentation'],
    max: ['definitionNavigation', 'autocomplete', 'hoverDocumentation'],
  },
};

export interface UserSubscription {
  tier: SubscriptionTier;
  /** Billing integration maps a canceled but still paid period to active until expiresAt. */
  status: 'active' | 'trialing' | 'inactive';
  /** ISO 8601 timestamp, or null for a grant without an expiry. */
  expiresAt: string | null;
}

/** Future API-owned profile; credentials, billing secrets, and tokens do not belong here. */
export interface UserProfile {
  id: string;
  email?: string;
  displayName?: string;
  subscription: UserSubscription | null;
}

export type AccessSubject = { kind: 'anonymous' } | { kind: 'authenticated'; user: UserProfile };

export const anonymousSubject: AccessSubject = { kind: 'anonymous' };

/**
 * Resolves a subscription without granting promotional anonymous access to inactive accounts.
 * @param subject Anonymous session or profile supplied by the future authenticated API.
 * @param policy Shared feature and plan configuration.
 * @param now Current Unix time in milliseconds, injectable for expiry checks.
 */
export function resolveSubscriptionTier(
  subject: AccessSubject,
  policy: FeaturePolicy = featurePolicy,
  now: number = Date.now(),
): SubscriptionTier {
  if (subject.kind === 'anonymous') return policy.anonymousTier;
  const subscription = subject.user.subscription;
  if (
    !subscription ||
    !['free', 'plus', 'max'].includes(subscription.tier) ||
    !['active', 'trialing'].includes(subscription.status)
  )
    return 'free';
  if (subscription.expiresAt !== null) {
    const expiry = Date.parse(subscription.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now) return 'free';
  }
  return subscription.tier;
}

/**
 * Computes feature availability; global off switches take priority over every plan and bypass.
 * @param subject Current anonymous session or authenticated account profile.
 * @param policy Editable feature switches, paywall switch, and plan membership lists.
 * @param now Current Unix time in milliseconds used to reject expired subscriptions.
 */
export function resolveFeatureAccess(
  subject: AccessSubject = anonymousSubject,
  policy: FeaturePolicy = featurePolicy,
  now: number = Date.now(),
): FeatureAccess {
  const tier = resolveSubscriptionTier(subject, policy, now);
  return Object.fromEntries(
    (Object.keys(policy.features) as Feature[]).map((feature) => [
      feature,
      policy.features[feature].enabled &&
        (!policy.paywallEnabled || policy.plans[tier].includes(feature)),
    ]),
  ) as Record<Feature, boolean>;
}
