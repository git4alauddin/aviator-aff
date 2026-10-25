/* Code-entry flow adapted from git4alauddin/dmfirst-affiliation.
 * This reveals local preset outcomes; it has no live-game prediction service.
 */
(() => {
  'use strict';
  window.mountAviatorPrediction = (settings, getRound) => {
    const $ = id => document.getElementById(id);
    const launcher = $('predictLauncher'), dialog = $('predictionDialog');
    if (settings?.enabled !== true) return;
    launcher.hidden = false;
    const text = {
      widgetLabel: 'PREDICT', terminalLabel: 'FLIGHT TERMINAL', entryTitle: 'Enter access code',
      entryHelp: 'Enter your code to open the Aviator preview.',
      unlockButton: 'Unlock', predictButton: 'Predict',
      predictAgainButton: 'Predict again', resultLabel: 'Preset crash multiplier',
    };
    for (const key of Object.keys(text)) {
      if (typeof settings.text?.[key] === 'string') text[key] = settings.text[key];
    }
    dialog.querySelectorAll('[data-predict-text]').forEach(el => { el.textContent = text[el.dataset.predictText]; });
    launcher.querySelector('span').textContent = text.widgetLabel;
    $('predictBrand').textContent = settings.brand || 'DM FIRST';
    $('predictGameName').textContent = settings.gameName || 'Aviator';
    dialog.querySelectorAll('[data-predict-game]').forEach(el => { el.textContent = settings.gameName || 'Aviator'; });
    const code = typeof settings.accessCode === 'string' ? settings.accessCode.trim() : '';
    const timing = (value, fallback) => Number.isFinite(value) && value >= 0 ? value : fallback;
    const unlockMs = timing(settings.unlockDurationMs, 1800);
    const holdMs = timing(settings.unlockHoldMs, 300);
    const revealMs = timing(settings.revealDurationMs, 1800);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const contact = settings.adminContact || {};
    const username = typeof contact.telegramUsername === 'string' ? contact.telegramUsername.trim().replace(/^@/, '') : '';
    let contactUrl = '', contactText = typeof contact.text === 'string' ? contact.text.trim() : '';
    try {
      const url = new URL(/^[a-zA-Z0-9_]+$/.test(username) ? `https://t.me/${username}` : contact.url);
      if (['https:', 'mailto:', 'tel:'].includes(url.protocol)) contactUrl = url.href;
      if (contactUrl && ['t.me', 'www.t.me'].includes(url.hostname) && /^\/[a-zA-Z0-9_]+\/?$/.test(url.pathname)) {
        contactText = '@' + url.pathname.replaceAll('/', '');
      }
    } catch {}
    $('predictAdminText').textContent = contactText;
    $('predictAdminText').hidden = !!contactUrl;
    $('predictAdminLink').textContent = contactText || 'Message admin';
    $('predictAdminLink').hidden = !contactUrl;
    if (contactUrl) $('predictAdminLink').href = contactUrl;

    let state = 'entry', watchId = 0, startedAt = 0, matches = false;
    let round = null, selected = null;
    const setValue = value => { $('predictValue').firstChild.nodeValue = value; };
    const progress = value => {
      $('predictProgress').style.setProperty('--progress', value + '%');
      $('predictProgress').setAttribute('aria-valuenow', value);
      $('predictPercent').textContent = value + '%';
    };

    function clearError() {
      if (state !== 'entry' || !code) return;
      $('predictCodeError').hidden = true;
      $('predictAdmin').hidden = true;
      $('predictCode').setAttribute('aria-invalid', 'false');
      $('predictAccessTitle').textContent = text.entryTitle;
      $('predictAccessHelp').textContent = text.entryHelp;
      $('predictUnlock').textContent = text.unlockButton;
      dialog.dataset.accessState = 'entry';
    }

    function reset() {
      watchId++;
      state = 'entry'; round = null; selected = null;
      dialog.dataset.accessState = 'entry';
      dialog.setAttribute('aria-labelledby', 'predictAccessTitle');
      dialog.setAttribute('aria-describedby', 'predictAccessHelp');
      $('predictAccess').hidden = false;
      $('predictPreview').hidden = true;
      $('predictCodeForm').hidden = false;
      $('predictChecking').hidden = true;
      $('predictCode').value = '';
      $('predictCode').setAttribute('aria-invalid', 'false');
      $('predictAccessTitle').textContent = text.entryTitle;
      $('predictAccessHelp').textContent = text.entryHelp;
      $('predictUnlock').textContent = text.unlockButton;
      $('predictUnlock').disabled = !code;
      $('predictCodeError').textContent = code ? '' : 'Access is unavailable right now.';
      $('predictCodeError').hidden = !!code;
      $('predictAdmin').hidden = true;
      progress(0);
    }

    function resetResult(message = 'Select Predict to reveal this demo round.') {
      state = 'ready'; selected = null;
      setValue('—');
      $('predictValue').setAttribute('aria-hidden', 'false');
      $('predictReady').hidden = true;
      $('predictResult').setAttribute('aria-busy', 'false');
      $('predictRun').disabled = !Number.isFinite(round?.target) || round.target < 1;
      $('predictRun').textContent = text.predictButton;
      $('predictStatus').textContent = $('predictRun').disabled ? 'No preset is available for this round.' : message;
    }

    function syncRound() {
      const latest = getRound();
      const changed = !round || latest.id !== round.id || latest.target !== round.target;
      const phaseChanged = !round || latest.phase !== round.phase;
      round = latest;
      if (changed) $('predictRoundLabel').textContent = `Round ${round.id}`;
      if (changed || phaseChanged) $('predictRoundPhase').textContent = round.phase === 'flying' ? 'In flight' : 'Upcoming';
      if (changed) resetResult('Round updated. Select Predict for this demo round.');
    }

    function finishCheck() {
      progress(100);
      $('predictChecking').hidden = true;
      if (!matches) {
        state = 'entry';
        dialog.dataset.accessState = 'failed';
        $('predictCodeForm').hidden = false;
        $('predictAccessTitle').textContent = 'Access denied';
        $('predictAccessHelp').textContent = 'Check your code and try again.';
        $('predictCodeError').textContent = "That code doesn't match. Try again.";
        $('predictCodeError').hidden = false;
        $('predictCode').setAttribute('aria-invalid', 'true');
        $('predictAdmin').hidden = !contactText && !contactUrl;
        $('predictUnlock').textContent = 'Try again';
        $('predictCode').focus();
        return;
      }
      state = 'ready';
      dialog.dataset.accessState = 'ready';
      dialog.setAttribute('aria-labelledby', 'predictGameName');
      dialog.setAttribute('aria-describedby', 'predictDisclosure');
      $('predictAccess').hidden = true;
      $('predictPreview').hidden = false;
      syncRound();
      $('predictGameName').focus();
    }

    function settle() {
      state = 'ready';
      setValue(selected.target.toFixed(2));
      $('predictValue').setAttribute('aria-hidden', 'false');
      $('predictResult').setAttribute('aria-busy', 'false');
      $('predictReady').hidden = false;
      $('predictRun').disabled = false;
      $('predictRun').textContent = text.predictAgainButton;
      $('predictStatus').textContent = `Round ${selected.id} · Configured demo crash: ${selected.target.toFixed(2)}x.`;
    }

    function watch(now, run) {
      if (run !== watchId || !dialog.open) return;
      if (state === 'checking') {
        const elapsed = Math.max(0, now - startedAt);
        progress(unlockMs === 0 ? 100 : Math.min(100, Math.floor(elapsed / unlockMs * 100)));
        if (elapsed >= unlockMs + holdMs) finishCheck();
      } else if (state === 'ready' || state === 'spinning') {
        syncRound();
        if (state === 'spinning') {
          if (motion.matches || now - startedAt >= revealMs) settle();
          else setValue((1 + ((Math.floor((now - startedAt) / 50) * 37) % 899) / 100).toFixed(2));
        }
      }
      requestAnimationFrame(time => watch(time, run));
    }

    launcher.addEventListener('click', () => {
      if (dialog.open) return;
      reset();
      dialog.showModal();
      launcher.setAttribute('aria-expanded', 'true');
      $('predictCode').focus();
      const run = watchId;
      requestAnimationFrame(time => watch(time, run));
    });
    $('predictCode').addEventListener('input', clearError);
    $('predictCodeForm').addEventListener('submit', event => {
      event.preventDefault();
      if (!dialog.open || state !== 'entry' || !code) return;
      const entered = $('predictCode').value.trim();
      clearError();
      if (!entered) {
        $('predictCodeError').textContent = 'Enter your access code.';
        $('predictCodeError').hidden = false;
        $('predictCode').setAttribute('aria-invalid', 'true');
        $('predictCode').focus();
        return;
      }
      matches = entered === code;
      state = 'checking'; startedAt = performance.now();
      dialog.dataset.accessState = 'checking';
      $('predictCode').value = '';
      $('predictCodeForm').hidden = true;
      $('predictChecking').hidden = false;
      $('predictAccessTitle').textContent = 'Checking code';
      $('predictAccessHelp').textContent = 'Please wait while we check your code.';
      $('predictAccessTitle').focus();
      progress(0);
    });
    $('predictRun').addEventListener('click', () => {
      if (!dialog.open || state !== 'ready') return;
      syncRound();
      if ($('predictRun').disabled) return;
      selected = { ...round };
      state = 'spinning'; startedAt = performance.now();
      $('predictRun').disabled = true;
      $('predictRun').textContent = 'Revealing…';
      $('predictReady').hidden = true;
      $('predictResult').setAttribute('aria-busy', 'true');
      $('predictValue').setAttribute('aria-hidden', 'true');
      $('predictStatus').textContent = `Reading the configured preset for round ${selected.id}…`;
      if (motion.matches || revealMs === 0) settle();
    });
    function closed() {
      if (dialog.open) return; // A queued close event may arrive after reopening.
      reset();
      launcher.setAttribute('aria-expanded', 'false');
      launcher.focus();
    }
    $('predictClose').addEventListener('click', () => { dialog.close(); closed(); });
    dialog.addEventListener('close', closed);
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) {
        dialog.close(); closed();
      }
    });
    reset();
  };
})();
