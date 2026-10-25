// Simple creator entry screen. The simulation starts only after unlocking.
(() => {
  'use strict';
  const gate = document.getElementById('studioGate');
  const app = document.getElementById('studioApp');
  const form = document.getElementById('studioGateForm');
  const input = document.getElementById('studioPassword');
  const button = document.getElementById('studioUnlock');
  const error = document.getElementById('studioGateError');
  const code = window.SIM_CONFIG.studio?.accessCode;
  let opening = false;

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }

  input.addEventListener('input', () => {
    error.hidden = true;
    input.setAttribute('aria-invalid', 'false');
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (opening) return;
    if (typeof code !== 'string' || !code.trim()) return showError('Studio access is unavailable.');
    if (!input.value.trim()) return showError('Enter your creator password.');
    if (input.value.trim() !== code.trim()) return showError('Incorrect password. Try again.');

    opening = true;
    button.disabled = true;
    button.textContent = 'Opening…';
    error.hidden = true;
    input.value = '';
    app.hidden = false;
    const script = document.createElement('script');
    script.src = 'app.js';
    script.addEventListener('load', () => {
      gate.hidden = true;
      app.inert = false;
      document.getElementById('menuButton').focus();
    }, {once: true});
    script.addEventListener('error', () => {
      script.remove();
      app.hidden = true;
      opening = false;
      button.disabled = false;
      button.textContent = 'Open Studio';
      showError('Studio could not load. Please try again.');
    }, {once: true});
    document.body.append(script);
  });
  input.focus();
})();
