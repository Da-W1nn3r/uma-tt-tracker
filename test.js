const R = require('./rating.js'), assert = require('assert');
assert.equal(R.newRating(1000, 3, 0), 1150);            // first round: full jump
assert.equal(R.effectivePeriod(10), 5);                 // caps at adjustingPeriod
for (const cur of [20, 720, 1000, 1250, 1900])
  for (let p = 1; p <= 3; p++) {                        // direction always matches placement
    assert.ok(R.newRating(cur, p, 3) > cur || cur >= R.CONFIG.maxRating);
    assert.ok(R.newRating(cur, -p, 3) < cur || cur <= R.CONFIG.minRating);
  }
let r = 1000; for (let i = 0; i < 200; i++) r = R.newRating(r, 3, i);
assert.equal(r, R.CONFIG.maxRating);                    // bounded by the cap
console.log('ok');
// consistent placers keep diverging (top 1 pulls away from top 3) well past the old cap
let a = 1000, b = 1000;
for (let i = 0; i < 20; i++) { a = R.newRating(a, 3, i); b = R.newRating(b, 1, i); }
assert.ok(a > 1500 && b < 1300 && a - b > 300);
// recenter keeps the mean at baseRating, preserving differences between umas
const c = R.recenter([1150, 1050, 1000, 1300]);
assert.ok(Math.abs(c.reduce((x, y) => x + y) / c.length - 1000) < 1e-9);
assert.equal(c[0] - c[1], 100);

// drift: no-op at baseRating, pulls outliers toward it, never overshoots past it
assert.equal(R.drift(1000), 1000);
assert.equal(R.drift(1200), 1200 - Math.pow(2, 200 / 200));
assert.equal(R.drift(800), 800 + Math.pow(2, 200 / 200));
assert.equal(R.drift(1000.5), 1000); // step (~1.0017) would overshoot past baseRating
assert.equal(R.drift(999.5), 1000);
// bigger outliers drift by more (exponential in distance)
assert.ok(Math.abs(1400 - R.drift(1400)) > Math.abs(1200 - R.drift(1200)));
