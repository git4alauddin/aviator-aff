(() => {
  'use strict';
  const cfg = window.SIM_CONFIG;
  const $ = id => document.getElementById(id);
  const banner = document.querySelector('.funMode');
  const disclaimer = cfg.disclaimer || {};
  banner.hidden = disclaimer.enabled === false;
  if (typeof disclaimer.text === 'string') banner.textContent = disclaimer.text;
  if (typeof disclaimer.tooltip === 'string') banner.title = disclaimer.tooltip;
  const fmt = value => Number(value).toFixed(2);
  const flight = new window.FlightRenderer($('flightSvg'), { ...cfg.flight, growthRate: cfg.growthRate });
  const panels = Array.from({ length: 2 }, () => ({ stake: 1, state: 'idle', cashMult: null, cashAmount: null, auto: false, autoCash: false, cashAt: 2 }));
  let sequence = 0, phase = 'waiting', phaseStart = performance.now();
  let roundId = 1;
  let paused = false, pausedAt = 0, multiplier = 1, balance = cfg.initialCredits;
  let history = [...cfg.initialHistory], activeTab = 'all';
  const activity = new window.StudioActivity(cfg.activity);
  const rowNodes = new Map();
  const money = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  let rowContext = '', leaderKey = '';
  let lastRowsUpdate = -1, toastTimer;
  const duration = point => Math.log(Math.max(1.001, point)) / cfg.growthRate * 1000;
  const colorClass = n => n >= 10 ? 'high' : n >= 2 ? 'mid' : '';
  const locked = b => b.state === 'placed' || b.state === 'queued';
  const stakeValue = value => Number.isFinite(Number(value)) ? Math.min(100000, Math.max(.1, Math.round(Number(value) * 100) / 100)) : 1;

  function avatar(index) {
    const palettes = [['#203c52','#ba8c68','#171c28'],['#4b294d','#d49367','#161323'],['#44706f','#d4b38a','#c7b7a0'],['#ddb222','#ffda56','#e8960a'],['#294b60','#b8d4dd','#6e91a7'],['#692d28','#e62b27','#171a20'],['#5390a4','#ddd4b9','#dd5b3b'],['#658c2f','#f5c445','#c94a31']];
    const [bg, skin, accent] = palettes[index % palettes.length];
    const art = index % 8 === 5
      ? `<path d="M4 19 7 10 22 9 27 19 25 25 6 25Z" fill="${skin}"/><path d="m9 11 11-1 3 7H7Z" fill="#17313c"/><path d="M5 20h21" stroke="#ff8282"/><circle cx="8" cy="25" r="3" fill="#141414"/><circle cx="23" cy="25" r="3" fill="#141414"/>`
      : index % 8 === 4
        ? `<path d="m16 3 12 9-4 15-15 1L3 13Z" fill="${skin}"/><path d="m16 3-2 10 14-1-10 8 6 7-10-4-5 5 1-11-7-4 11-1Z" fill="${accent}"/><path d="m16 3 2 17-9 8 5-15Z" fill="#e7f4f3" opacity=".65"/>`
        : `<path d="M2 32q1-12 14-12t14 12" fill="${accent}"/><ellipse cx="16" cy="14" rx="8" ry="10" fill="${skin}"/><path d="M8 13V9Q8 1 17 3q9 0 7 10l-4-5-10 1Z" fill="${accent}"/><path d="m8 12 7 1h2l7-1-1 5-6-1-2 1-6-1Z" fill="#14202d"/><path d="m17 23 3-4-6 1" fill="#754638"/><path d="m9 13 5 1m4 0 4-1" stroke="#809da9" stroke-width=".8"/>`;
    return `<span class="avatar" aria-hidden="true"><svg viewBox="0 0 32 32"><rect width="32" height="32" fill="${bg}"/>${art}</svg></span>`;
  }

  function notify(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3000);
  }

  function showWin(at, amount) {
    const notification = document.createElement('div');
    notification.className = 'winNotification';
    notification.setAttribute('role', 'status');
    const stars = '<svg class="winStars" viewBox="0 0 112 38" aria-hidden="true"><path d="m13 4 2 4 4 .6-3 3 .7 4-3.7-2-3.7 2 .7-4-3-3 4-.6Z M8 17l1.4 2.8 3.1.5-2.3 2.2.5 3.1L8 24.2l-2.7 1.4.5-3.1-2.3-2.2 3.1-.5Z M99 4l2 4 4 .6-3 3 .7 4-3.7-2-3.7 2 .7-4-3-3 4-.6Z M104 17l1.4 2.8 3.1.5-2.3 2.2.5 3.1-2.7-1.4-2.7 1.4.5-3.1-2.3-2.2 3.1-.5Z"/></svg>';
    notification.innerHTML = `<div class="winMessage"><span>You have cashed out!</span><strong>${fmt(at)}x</strong></div><div class="winPrize">${stars}<span>Win ${cfg.currency}</span><strong>${fmt(amount)}</strong></div><button class="winClose" aria-label="Dismiss cash-out notification">×</button>`;
    let timer;
    const dismiss = () => { clearTimeout(timer); notification.remove(); };
    notification.querySelector('button').addEventListener('click', dismiss);
    $('winNotifications').append(notification);
    // Keep both independent panels' wins visible when they settle together.
    while ($('winNotifications').children.length > 2) $('winNotifications').firstElementChild.remove();
    timer = setTimeout(dismiss, 5000);
  }

  function renderHistory() {
    const markup = history.slice(0, cfg.maxDisplayedHistory).map(n => `<span class="pill ${colorClass(n)}">${fmt(n)}x</span>`).join('');
    $('history').innerHTML = markup;
    $('expandedHistory').innerHTML = history.map(n => `<span class="pill ${colorClass(n)}">${fmt(n)}x</span>`).join('');
  }

  function playerAvatar(profile) {
    if (!profile.photo) return avatar(profile.icon);
    const file = profile.icon === 0 ? 'img.png' : `img_${profile.icon}.png`;
    return `<span class="avatar" aria-hidden="true"><img src="assets/images/avatars/${file}" alt="" width="25" height="25" draggable="false"></span>`;
  }

  function renderRows() {
    const view = activity.view(activeTab);
    const context = `${activeTab}-${view.round?.id ?? 'empty'}`;
    const list = $('betrows');
    if (rowContext !== context) {
      rowContext = context; rowNodes.clear(); list.replaceChildren();
    }
    if (!view.rows.length) {
      if (!list.querySelector('.emptyRows')) {
        list.innerHTML = `<p class="emptyRows">${activeTab === 'previous' ? 'Completed round bets appear here.' : activeTab === 'top' ? 'Cash-outs appear here as the round progresses.' : 'Waiting for simulated bets.'}</p>`;
      }
    } else {
      list.querySelector('.emptyRows')?.remove();
      view.rows.forEach((row, index) => {
        let node = rowNodes.get(row.id);
        if (!node) {
          node = document.createElement('div');
          node.className = 'betrow';
          node.dataset.rowId = row.id;
          node.dataset.playerId = String(row.profile.id);
          node.dataset.stakeCents = String(row.stakeCents);
          node.innerHTML = `<span class="player">${playerAvatar(row.profile)}<span>${row.profile.name}</span></span><span>${money.format(row.stakeCents / 100)}</span><span class="result"></span><span class="payout"></span>`;
          rowNodes.set(row.id, node);
        }
        if (node.dataset.state !== row.state) {
          node.classList.toggle('paid', row.state === 'cashed');
          node.classList.toggle('lost', row.state === 'lost');
          node.dataset.state = row.state;
          node.dataset.payoutCents = String(row.payoutCents);
          node.querySelector('.result').textContent = row.state === 'cashed' ? fmt(row.cashAt) + 'x' : row.state === 'lost' ? '—' : '';
          node.querySelector('.payout').textContent = row.state === 'cashed' ? money.format(row.payoutCents / 100) : row.state === 'lost' ? '—' : '';
        }
        if (list.children[index] !== node) list.insertBefore(node, list.children[index] || null);
      });
      while (list.children.length > view.rows.length) list.lastElementChild.remove();
    }
    $('totalWin').textContent = money.format(view.totalWinCents / 100);
    $('count').textContent = `${view.cashOutCount}/${view.betCount}`;
    $('summaryProgress').style.width = `${view.betCount ? view.cashOutCount / view.betCount * 100 : 0}%`;
    const leaders = view.leaders.map(profile => profile.id).join(',');
    if (leaderKey !== leaders) {
      leaderKey = leaders;
      $('summaryAvatars').innerHTML = view.leaders.map(playerAvatar).join('');
    }
  }

  function updateWallet() {
    $('wallet').textContent = balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $('currency').textContent = cfg.currency;
    document.querySelectorAll('.unit').forEach(el => { el.textContent = cfg.currency; });
  }

  function updateControls() {
    panels.forEach((b, i) => {
      const button = $('action' + i);
      let style = '', label = `Bet<br>${fmt(b.stake)} <small>${cfg.currency}</small>`;
      button.disabled = false;
      if (b.state === 'cashed') { style = 'settled'; label = `Cashed out<br>${fmt(b.cashAmount)} <small>${cfg.currency}</small>`; button.disabled = true; }
      else if (phase === 'flying' && b.state === 'placed') { style = 'cash'; label = `Cash Out<br>${fmt(b.stake * Number(fmt(multiplier)))} <small>${cfg.currency}</small>`; }
      else if (locked(b)) { style = 'pending'; label = `Cancel<br><small>${b.state === 'queued' ? 'Next round' : 'Bet placed'}</small>`; }
      else if (b.state === 'lost') { style = 'settled'; label = `Flew away<br><small>Next round soon</small>`; button.disabled = true; }
      button.className = `action ${style}`;
      // Avoid replacing unchanged button contents on every animation frame.
      if (button.innerHTML !== label) button.innerHTML = label;
      const input = $('stake' + i);
      input.disabled = locked(b);
      if (document.activeElement !== input) input.value = fmt(b.stake);
      $('panel' + i).querySelectorAll('[data-set],[data-adjust]').forEach(el => { el.disabled = locked(b); });
    });
  }

  function buildControls() {
    $('controlRow').innerHTML = panels.map((b, i) => `<section class="betPanel" id="panel${i}" aria-label="Virtual bet panel ${i + 1}">
      <div class="seg" aria-label="Bet mode"><button class="selected" data-mode="bet" data-panel="${i}" aria-pressed="true">Bet</button><button data-mode="auto" data-panel="${i}" aria-pressed="false">Auto</button></div>
      <div class="betBody"><div class="stake"><div class="number"><button data-adjust="-1" data-panel="${i}" aria-label="Decrease stake ${i + 1}">−</button><input id="stake${i}" type="number" min="0.10" max="100000" step="0.10" value="1.00" aria-label="Virtual stake panel ${i + 1}"><button data-adjust="1" data-panel="${i}" aria-label="Increase stake ${i + 1}">+</button></div>
      <div class="presets">${[1,2,5,10].map(n => `<button data-set="${n}" data-panel="${i}">${n}</button>`).join('')}</div></div><button class="action" id="action${i}" data-action="${i}"></button></div>
      <div class="autoOptions" id="autoOptions${i}" hidden><label><input type="checkbox" id="autoBet${i}">Auto bet</label><label><input type="checkbox" id="autoCash${i}">Auto cash out</label><input type="number" id="cashAt${i}" min="1.01" step="0.01" max="1000" value="2.00" aria-label="Auto cash out multiplier panel ${i + 1}"></div>
    </section>`).join('');
    $('controlRow').addEventListener('click', event => {
      const t = event.target.closest('button');
      if (!t) return;
      const i = Number(t.dataset.panel ?? t.dataset.action), b = panels[i];
      if ('action' in t.dataset) return handleBet(i);
      if ('mode' in t.dataset) {
        const autoMode = t.dataset.mode === 'auto';
        $('panel' + i).classList.toggle('autoMode', autoMode);
        $('autoOptions' + i).hidden = !autoMode;
        $('panel' + i).querySelectorAll('[data-mode]').forEach(el => { const selected = el === t; el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', String(selected)); });
        return;
      }
      if (locked(b)) return;
      if ('set' in t.dataset) b.stake = Number(t.dataset.set);
      if ('adjust' in t.dataset) b.stake = stakeValue(b.stake + Number(t.dataset.adjust));
      updateControls();
    });
    $('controlRow').addEventListener('change', event => {
      const t = event.target, i = Number(t.id.slice(-1)), b = panels[i];
      if (!b) return;
      if (t.id.startsWith('stake') && !locked(b)) b.stake = stakeValue(t.value);
      if (t.id.startsWith('autoBet')) b.auto = t.checked;
      if (t.id.startsWith('autoCash')) b.autoCash = t.checked;
      if (t.id.startsWith('cashAt')) { b.cashAt = Math.max(1.01, Math.min(1000, Number(t.value) || 2)); t.value = fmt(b.cashAt); }
      updateControls();
    });
  }

  function placeBet(b) {
    if (b.stake > balance) { notify('Not enough virtual credits for this bet.'); return false; }
    balance = +(balance - b.stake).toFixed(2);
    b.state = phase === 'waiting' ? 'placed' : 'queued';
    updateWallet();
    return true;
  }

  function cashOut(b, at) {
    b.state = 'cashed'; b.cashMult = Number(fmt(at));
    b.cashAmount = Number(fmt(b.stake * b.cashMult));
    balance = Number(fmt(balance + b.cashAmount));
    updateWallet();
    showWin(b.cashMult, b.cashAmount);
  }

  function handleBet(i) {
    const b = panels[i];
    if (paused) return notify('Resume the simulation to place or change a bet.');
    if (phase === 'flying' && b.state === 'placed') cashOut(b, multiplier);
    else if (locked(b)) { balance = +(balance + b.stake).toFixed(2); b.state = 'idle'; updateWallet(); }
    else if (b.state === 'idle') placeBet(b);
    updateControls();
  }

  function startWaiting(now) {
    phase = 'waiting'; phaseStart = now; multiplier = 1; lastRowsUpdate = -1;
    flight.beginRound();
    activity.startRound(roundId, cfg.countdownSeconds * 1000);
    $('spectatorAvatars').innerHTML = activity.current.rows.slice(0, 3).map(row => playerAvatar(row.profile)).join('');
    $('spectatorCount').textContent = activity.spectatorCount.toLocaleString('en-US');
    panels.forEach(b => {
      if (b.state === 'queued') b.state = 'placed';
      else { b.state = 'idle'; b.cashMult = null; b.cashAmount = null; if (b.auto && !placeBet(b)) { b.auto = false; $('autoBet' + panels.indexOf(b)).checked = false; } }
    });
    flight.draw(0, 'waiting'); renderRows(); updateControls();
    $('roundLabel').textContent = `Round ${sequence + 1} / ${cfg.crashPoints.length} · Preset outcomes`;
  }

  function crash(now, target) {
    multiplier = target; phase = 'crashed'; phaseStart = now;
    history.unshift(target); history = history.slice(0, 100); renderHistory();
    panels.forEach(b => { if (b.state === 'placed') b.state = 'lost'; });
    activity.finishRound(target);
    renderRows();
  }

  function render(now) {
    const age = Math.max(0, now - phaseStart), target = cfg.crashPoints[sequence % cfg.crashPoints.length];
    const activityAge = phase === 'waiting' ? age : cfg.countdownSeconds * 1000 + (phase === 'flying' ? age : duration(target) + age);
    if (activity.updateSpectators(activityAge)) $('spectatorCount').textContent = activity.spectatorCount.toLocaleString('en-US');
    if (phase === 'waiting') {
      flight.draw(0, 'waiting', age / 1000);
      const remaining = Math.max(0, 1 - age / (cfg.countdownSeconds * 1000));
      $('status').innerHTML = `<div class="waitLogo">Aviator</div><div class="waiting">WAITING FOR NEXT ROUND</div><div class="waitTrack"><span style="transform:scaleX(${remaining})"></span></div>`;
      const rowTick = Math.floor(age / activity.refreshMs);
      if (rowTick !== lastRowsUpdate) { lastRowsUpdate = rowTick; activity.join(age); renderRows(); }
      if (age >= cfg.countdownSeconds * 1000) {
        activity.takeoff(); phase = 'flying'; phaseStart = now; lastRowsUpdate = -1; renderRows();
      }
    } else if (phase === 'flying') {
      const flightAge = Math.min(age, duration(target));
      multiplier = Math.min(target, Math.exp(cfg.growthRate * flightAge / 1000));
      panels.forEach(b => { if (b.state === 'placed' && b.autoCash && multiplier >= b.cashAt && b.cashAt < target) cashOut(b, b.cashAt); });
      flight.draw(flightAge / 1000, 'flying', 0, multiplier);
      $('status').innerHTML = `<div class="mult">${fmt(multiplier)}x</div>`;
      const rowTick = Math.floor(age / activity.refreshMs);
      if (rowTick !== lastRowsUpdate) { lastRowsUpdate = rowTick; activity.cashOut(multiplier, target); renderRows(); }
      if (age >= duration(target)) crash(now, target);
    } else {
      flight.draw(duration(target) / 1000, 'crashed', age / 1000, target);
      $('status').innerHTML = `<div class="crashCaption">FLEW AWAY!</div><div class="crashMult">${fmt(target)}x</div>`;
      if (age >= cfg.postCrashSeconds * 1000) { sequence = (sequence + 1) % cfg.crashPoints.length; roundId++; startWaiting(now); }
    }
    updateControls();
  }

  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
    activeTab = button.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(el => { el.classList.toggle('active', el === button); el.setAttribute('aria-selected', String(el === button)); });
    $('betrows').setAttribute('aria-labelledby', button.id); renderRows();
  }));
  function togglePopover(buttonId, panelId) {
    const button = $(buttonId), panel = $(panelId);
    button.addEventListener('click', () => { panel.hidden = !panel.hidden; button.setAttribute('aria-expanded', String(!panel.hidden)); });
    document.addEventListener('click', e => { if (!panel.contains(e.target) && !button.contains(e.target)) { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); } });
  }
  togglePopover('menuButton', 'settings'); togglePopover('historyButton', 'historyPopover');
  $('pause').addEventListener('click', () => {
    paused = !paused;
    if (paused) pausedAt = performance.now(); else phaseStart += performance.now() - pausedAt;
    $('pause').textContent = paused ? 'Resume' : 'Pause';
  });
  $('next').addEventListener('click', () => {
    // Skipping a demonstration round refunds unsettled stakes.
    panels.forEach(b => { if (locked(b)) { balance = +(balance + b.stake).toFixed(2); b.state = 'idle'; } });
    sequence = (sequence + 1) % cfg.crashPoints.length;
    roundId++;
    const now = performance.now(); if (paused) pausedAt = now;
    startWaiting(now); updateWallet(); render(now);
  });
  buildControls(); renderHistory(); updateWallet(); startWaiting(performance.now());
  // Pass only public widget settings and a round snapshot, never the whole game config.
  window.mountAviatorPrediction(cfg.prediction, () => {
    const next = phase === 'crashed';
    return {
      id: roundId + Number(next),
      phase: next ? 'waiting' : phase,
      target: cfg.crashPoints[(sequence + Number(next)) % cfg.crashPoints.length],
    };
  }, { requireCode: false });
  if (cfg.prediction?.enabled === true) {
    const draggable = window.mountDraggableWidget($('predictLauncher'), {
      boundsElement: document.querySelector('.flightStage'),
    });
    window.addEventListener('pagehide', () => draggable.destroy(), {once: true});
  }
  function tick(now) { if (!paused) render(now); requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
})();
