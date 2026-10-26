/* Synthetic round activity for Creator Studio. No external player data is used. */
(() => {
  'use strict';
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const range = (settings, defaults, floor, ceiling) => {
    const min = clamp(finite(settings?.min, defaults.min), floor, ceiling);
    return {min, max: clamp(finite(settings?.max, defaults.max), min, ceiling)};
  };

  globalThis.StudioActivity = class StudioActivity {
    constructor(settings = {}, random = Math.random) {
      this.random = random;
      this.players = range(settings.players, {min: 120, max: 210}, 1, 500);
      this.stakes = range(settings.stakes, {min: 1, max: 2500}, .1, 100000);
      this.spectators = range(settings.spectators, {min: 90, max: 260}, 0, 100000);
      this.returningShare = clamp(finite(settings.returningShare, .65), 0, 1);
      this.refreshMs = clamp(finite(settings.refreshMs, 200), 100, 2000);
      const offset = this.integer(0, 899);
      this.profiles = Array.from({length: Math.ceil(this.players.max) * 3}, (_, index) => ({
        id: index + 1,
        name: `${this.integer(1, 9)}***${100 + (offset + index * 137) % 900}`,
        icon: this.integer(0, 9),
        photo: this.random() < .6,
        risk: this.random(),
        budget: this.random(),
      }));
      this.current = null;
      this.previous = null;
      this.spectatorCount = this.integer(this.spectators.min, this.spectators.max);
      this.lastSpectatorTick = 0;
    }

    integer(min, max) { return Math.floor(min + this.random() * (max - min + 1)); }

    shuffle(items) {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i--) {
        const j = this.integer(0, i);
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    }

    stake(profile) {
      const ratio = this.stakes.max / this.stakes.min;
      const percentile = clamp(profile.budget * .55 + this.random() * .45, 0, 1) ** 1.7;
      const raw = this.stakes.min * ratio ** percentile;
      const step = raw < 10 ? .5 : raw < 50 ? 5 : raw < 250 ? 10 : raw < 1000 ? 50 : 100;
      const amount = this.random() < .12 ? Math.round(raw * 100) / 100 : Math.round(raw / step) * step;
      return Math.round(clamp(amount, this.stakes.min, this.stakes.max) * 100);
    }

    cashAt(profile) {
      // Choose intent independently of the configured crash point.
      if (this.random() < .12) return null;
      const risk = clamp(profile.risk * .55 + this.random() * .45, 0, 1);
      if (risk < .57) return this.integer(108, 195) / 100;
      if (risk < .87) return this.integer(200, 480) / 100;
      return this.integer(500, 1800) / 100;
    }

    startRound(id, countdownMs) {
      const count = this.integer(Math.ceil(this.players.min), Math.floor(this.players.max));
      const returning = this.shuffle(this.current?.rows.map(row => row.profile) || [])
        .slice(0, Math.min(count, Math.floor(count * this.returningShare)));
      const selected = new Set(returning.map(profile => profile.id));
      const newcomers = this.shuffle(this.profiles.filter(profile => !selected.has(profile.id))).slice(0, count - returning.length);
      const profiles = this.shuffle([...returning, ...newcomers]);
      this.current = {
        id, phase: 'waiting', revision: 0,
        rows: profiles.map((profile, index) => ({
          id: `${id}-${profile.id}`, profile,
          stakeCents: this.stake(profile), cashAt: this.cashAt(profile),
          joinMs: index === 0 || this.random() < .3 ? 0 : Math.floor(Math.max(0, countdownMs) * (.04 + this.random() ** .65 * .91)),
          state: 'pending', payoutCents: 0,
        })).sort((a, b) => a.joinMs - b.joinMs),
      };
      this.lastSpectatorTick = 0;
      this.join(0);
      return this.current;
    }

    join(elapsedMs) {
      if (this.current.phase !== 'waiting') return;
      let changed = false;
      for (const row of this.current.rows) {
        if (row.state === 'pending' && row.joinMs <= elapsedMs) {
          row.state = 'placed'; changed = true;
        }
      }
      if (changed) this.current.revision++;
    }

    takeoff() {
      if (this.current.phase !== 'waiting') return;
      this.join(Infinity);
      this.current.phase = 'flying';
      this.current.revision++;
    }

    cashOut(multiplier, crashPoint) {
      if (this.current.phase !== 'flying') return;
      let changed = false;
      for (const row of this.current.rows) {
        if (row.state === 'placed' && row.cashAt !== null && row.cashAt <= multiplier && row.cashAt < crashPoint) {
          row.state = 'cashed';
          row.payoutCents = Math.round(row.stakeCents * Math.round(row.cashAt * 100) / 100);
          changed = true;
        }
      }
      if (changed) this.current.revision++;
    }

    finishRound(crashPoint) {
      if (this.current.phase === 'crashed') return;
      this.takeoff();
      this.cashOut(crashPoint, crashPoint);
      for (const row of this.current.rows) if (row.state === 'placed') row.state = 'lost';
      this.current.phase = 'crashed';
      this.current.revision++;
      this.previous = {
        ...this.current,
        rows: this.current.rows.map(row => ({...row, profile: {...row.profile}})),
      };
    }

    updateSpectators(elapsedMs) {
      const tick = Math.floor(elapsedMs / 2300);
      if (tick === this.lastSpectatorTick) return false;
      this.lastSpectatorTick = tick;
      const next = clamp(this.spectatorCount + this.integer(-3, 4), this.spectators.min, this.spectators.max);
      const changed = next !== this.spectatorCount;
      this.spectatorCount = next;
      return changed;
    }

    view(tab = 'all') {
      const round = tab === 'previous' ? this.previous : this.current;
      const joined = round?.rows.filter(row => row.state !== 'pending') || [];
      const winners = joined.filter(row => row.state === 'cashed');
      const ranked = [...winners].sort((a, b) => b.payoutCents - a.payoutCents || a.id.localeCompare(b.id));
      return {
        round, rows: tab === 'top' ? ranked : joined,
        betCount: joined.length, cashOutCount: winners.length,
        totalWinCents: winners.reduce((total, row) => total + row.payoutCents, 0),
        leaders: (ranked.length ? ranked : joined).slice(0, 3).map(row => row.profile),
      };
    }
  };
})();
