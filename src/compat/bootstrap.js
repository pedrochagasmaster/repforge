/** Temporary root for slices 2–18. Check the controlling release before importing
 * any app/storage code, then await native bindings and classic owners in order. */
import {startRelease} from '../release/gate.js';

const releaseId = document.querySelector('meta[name="taurifer-release"]')?.getAttribute('content');
let serviceWorker = null;
let registration = Promise.resolve(null);
try {
  serviceWorker = navigator.serviceWorker;
  if (serviceWorker) registration = Promise.resolve(serviceWorker.register(new URL('./sw.js', document.baseURI))).catch(() => null);
} catch { /* Restricted service workers do not prevent network-only training. */ }

function recover(error) {
  const host = document.createElement('section');
  host.id = 'releaseRecovery';
  host.setAttribute('role', 'alert');
  host.setAttribute('aria-labelledby', 'releaseRecoveryTitle');
  const title = document.createElement('h1');
  title.id = 'releaseRecoveryTitle';
  const body = document.createElement('p');
  const retry = document.createElement('button');
  const pt = navigator.language?.toLowerCase().startsWith('pt');
  title.textContent = pt ? 'Atualização necessária' : 'Update needed';
  body.textContent = error === 'update-required'
    ? (pt ? 'Seus dados continuam neste dispositivo. Feche todas as abas e o app e abra novamente para concluir a atualização.'
      : 'Your data stays on this device. Close all Taurifer tabs and the app, then reopen to finish updating.')
    : (pt ? 'Não foi possível abrir o app completo. Seus dados continuam neste dispositivo. Conecte-se e tente novamente.'
      : 'The complete app could not load. Your data stays on this device. Connect and try again.');
  retry.type = 'button';
  retry.textContent = pt ? 'Tentar novamente' : 'Try again';
  retry.addEventListener('click', async () => {
    try { await (await registration)?.update(); } catch { /* existing data stays untouched */ }
    location.reload();
  });
  host.append(title, body, retry);
  for (const child of document.body.children) {
    if (!child.matches('script')) child.setAttribute('inert', '');
  }
  document.body.append(host);
  retry.focus();
  window.__repforgeReleaseState = error;
}

async function load() {
  const {bindMigratedScript} = await import('./legacy-host.js');
  for (const placeholder of document.querySelectorAll('script[type="application/taurifer-script"][src]')) {
    const url = new URL(placeholder.getAttribute('src'), document.baseURI);
    // The assembler mirrors the original repository paths under one release.
    const path = url.pathname.replace(/^.*\/releases\/[^/]+\//, '').split('/').at(-1);
    if (bindMigratedScript(path, window)) continue;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url.href;
      if (placeholder.hasAttribute('data-module')) script.type = 'module';
      script.async = false;
      if (placeholder.hasAttribute('data-optional-runtime'))
        script.dataset.optionalRuntime = placeholder.getAttribute('data-optional-runtime');
      script.onload = resolve;
      script.onerror = placeholder.hasAttribute('data-optional-runtime') ? resolve : reject;
      document.head.append(script);
    });
  }
}

if (!releaseId) recover('missing-release-identity');
else startRelease({controller: serviceWorker?.controller, releaseId, load})
  .then(status => { if (status === 'update-required') recover(status); else window.__repforgeReleaseState = status; })
  .catch(() => recover('load-failed'));
