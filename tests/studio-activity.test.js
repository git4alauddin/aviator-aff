import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/studio-activity.js';

const StudioActivity = globalThis.StudioActivity;
function random(seed = 42) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const make = (settings = {}, seed = 42) => new StudioActivity(settings, random(seed));

test('bets arrive during countdown, retain identity, and stop joining at takeoff', () => {
  const activity = make();
  activity.startRound(1, 4000);
  const initial = activity.view().betCount;
  activity.join(2000);
  const middle = activity.view().betCount;
  activity.takeoff();
  const rows = activity.view().rows;
  assert.ok(initial > 0 && middle > initial && rows.length > middle);
  assert.ok(rows.length >= 120 && rows.length <= 210);
  assert.equal(new Set(rows.map(row => row.profile.id)).size, rows.length);
  assert.ok(rows.every(row => /^\d\*{3}\d{3}$/.test(row.profile.name)), 'Masked player IDs start with digits');
  assert.ok(new Set(rows.map(row => row.stakeCents)).size > 12);
  assert.ok(rows.every(row => row.stakeCents >= 100 && row.stakeCents <= 250000));
  const revision = activity.current.revision;
  activity.join(Infinity);
  assert.equal(activity.current.revision, revision);
});

test('cash-outs round to cents, settle once, and equal-to-crash targets lose', () => {
  const activity = make({players: {min: 4, max: 4}});
  activity.startRound(1, 1000);
  const [early, equal, late, hold] = activity.current.rows;
  Object.assign(early, {stakeCents: 123, cashAt: 1.11});
  Object.assign(equal, {stakeCents: 1005, cashAt: 1.2});
  late.cashAt = 3;
  hold.cashAt = null;
  activity.takeoff();
  activity.cashOut(1.11, 1.2);
  assert.equal(early.payoutCents, 137);
  activity.cashOut(1.15, 1.2);
  assert.equal(activity.view().totalWinCents, 137);
  activity.finishRound(1.2);
  activity.finishRound(1.2);
  assert.equal(early.state, 'cashed');
  assert.ok([equal, late, hold].every(row => row.state === 'lost' && row.payoutCents === 0));
  assert.equal(activity.view().cashOutCount, 1);
  assert.equal(activity.view().betCount, 4);
  assert.equal(activity.view('top').rows.length, 1);
  assert.equal(activity.view('previous').totalWinCents, 137);
});

test('skipped animation frames give the same settlements as gradual flight updates', () => {
  const gradual = make(), delayed = make();
  for (const activity of [gradual, delayed]) { activity.startRound(1, 4000); activity.takeoff(); }
  for (const multiplier of [1.1, 1.3, 1.7, 2.3, 3, 4.5, 7.9]) gradual.cashOut(multiplier, 8);
  gradual.finishRound(8);
  delayed.finishRound(8);
  assert.deepEqual(gradual.view().rows, delayed.view().rows);
  assert.equal(gradual.view().totalWinCents, delayed.view().totalWinCents);
  assert.equal(gradual.view().cashOutCount, delayed.view().cashOutCount);
});

test('previous round is immutable while returning players keep their identities', () => {
  const activity = make({players: {min: 40, max: 40}, returningShare: .65});
  activity.startRound(1, 4000);
  activity.finishRound(2.56);
  const before = JSON.stringify(activity.view('previous'));
  const identities = new Map(activity.current.rows.map(row => [row.profile.id, {...row.profile}]));
  activity.startRound(2, 4000);
  const returning = activity.current.rows.filter(row => identities.has(row.profile.id));
  assert.ok(returning.length >= 26);
  for (const row of returning) assert.deepEqual(row.profile, identities.get(row.profile.id));
  activity.takeoff();
  activity.cashOut(10, 12);
  assert.equal(JSON.stringify(activity.view('previous')), before);
  assert.ok(activity.view().rows.every(row => row.id.startsWith('2-')));
});

test('summary and Top ranking use precisely the same settled bets', () => {
  const activity = make();
  activity.startRound(1, 4000);
  activity.finishRound(6.5);
  const view = activity.view(), top = activity.view('top');
  const paid = view.rows.filter(row => row.state === 'cashed');
  assert.equal(view.cashOutCount, paid.length);
  assert.equal(view.totalWinCents, paid.reduce((sum, row) => sum + row.payoutCents, 0));
  assert.ok(top.rows.every((row, index) => row.state === 'cashed' && (!index || top.rows[index - 1].payoutCents >= row.payoutCents)));
  assert.equal(top.totalWinCents, view.totalWinCents);
  assert.ok(paid.every(row => row.cashAt < 6.5));
});

test('instant crash produces losses and configured stakes and spectators remain bounded', () => {
  const activity = make({players: {min: 20, max: 25}, stakes: {min: .25, max: 8}, spectators: {min: 3, max: 9}});
  activity.startRound(1, 0);
  activity.finishRound(1);
  assert.equal(activity.view().cashOutCount, 0);
  assert.equal(activity.view().totalWinCents, 0);
  assert.equal(activity.view('top').rows.length, 0);
  assert.ok(activity.view().rows.every(row => row.state === 'lost' && row.stakeCents >= 25 && row.stakeCents <= 800));
  for (let time = 0; time < 100000; time += 2300) {
    activity.updateSpectators(time);
    assert.ok(activity.spectatorCount >= 3 && activity.spectatorCount <= 9);
  }
});
