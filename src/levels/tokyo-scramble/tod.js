// =====================================================================================
//  Time of day. Level 6 is a BRIGHT OVERCAST AFTERNOON (the brief: the game's first real daylight
//  level). The art modules were first built for night neon; everything that glows reads its daytime
//  strength from here, so the night look survives as `?night=1` for comparison.
//   - emK:   the rm-material emissive (lamp heads, lit shop ceilings, crown rings) — mostly off by day
//   - signK: how much a sign face glows on top of its printed colour (lightboxes by day ≈ print)
//   - glows: billboard glow sprites (lamps, halos) — only the ones flagged day:true (aviation strobes)
// =====================================================================================
const night = typeof location !== 'undefined' && /[?&]night=1/.test(location.search);
export const DAY = {
  on: !night,
  emK: { value: night ? 1 : 0.32 },
  signK: { value: night ? 1 : 0.32 },
  facadeNight: night ? 1 : 0.16,
  groundK: night ? 1 : 0,
};
