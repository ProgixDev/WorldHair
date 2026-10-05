import { teamLimitOf, tierOfLookupKey } from './tiers';

describe('subscription tiers (TODO.md Phase 3)', () => {
  it('lets a solo salon work alone and an Équipe salon bring up to five people, owner included', () => {
    expect(teamLimitOf({ tier: 'solo' })).toBe(1);
    expect(teamLimitOf({ tier: 'team' })).toBe(5);
  });

  it('reads a salon without a subscription, or from before tiers, as solo', () => {
    expect(teamLimitOf(null)).toBe(1);
    expect(teamLimitOf({ tier: undefined })).toBe(1);
  });

  it("finds a price's tier from its lookup key, the old single price included", () => {
    expect(tierOfLookupKey('worldhair_team_yearly')).toBe('team');
    expect(tierOfLookupKey('worldhair_solo_monthly')).toBe('solo');
    expect(tierOfLookupKey('worldhair_pro_monthly')).toBe('solo');
    expect(tierOfLookupKey(null)).toBe('solo');
  });
});
