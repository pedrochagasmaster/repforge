/** Native composition entry. Verify the controlling release before loading
 * optional vendor/config resources or importing the application writer graph. */
import {startRelease} from './release/gate.js';
import {createOptionalScriptLoader} from './platform/optional-script.js';

const releaseId = document.querySelector('meta[name="taurifer-release"]')?.getAttribute('content');
let serviceWorker = null;
/** @type {Promise<ServiceWorkerRegistration|null>} */
let registration = Promise.resolve(null);
try {
  serviceWorker = navigator.serviceWorker;
  if (serviceWorker) registration = Promise.resolve(serviceWorker.register(new URL('./sw.js', document.baseURI))).catch(() => null);
} catch { /* Restricted service workers do not prevent network-only training. */ }

/** @param {string} error */
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
  (/** @type {Window & {__repforgeReleaseState?:string}} */(window)).__repforgeReleaseState = error;
}

async function load() {
  const entry=document.querySelector('link[rel="taurifer-entry"]');
  if(!(entry instanceof HTMLLinkElement))throw new Error('Native application entry unavailable');
  const optional=createOptionalScriptLoader({document});
  // These pinned third-party IIFEs keep their own vendor interfaces. Application
  // policy and state have no classic script or compatibility namespace.
  await optional.load(new URL('../vendor/motion/motion.js',import.meta.url));
  await optional.load(new URL('../vendor/dnd-kit/dnd-kit.js',import.meta.url));
  const config=document.querySelector('link[rel="taurifer-config"]');
  if(config instanceof HTMLLinkElement)await optional.load(config.href);
  try{
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.type='module';script.src=entry.href;
      script.onload=resolve;script.onerror=reject;document.head.append(script);
    });
  }finally{optional.dispose()}
}

if (!releaseId) recover('missing-release-identity');
else startRelease({controller: serviceWorker?.controller, releaseId, load})
  .then(status => { if (status === 'update-required') recover(status); else (/** @type {Window & {__repforgeReleaseState?:string}} */(window)).__repforgeReleaseState = status; })
  .catch(() => recover('load-failed'));
