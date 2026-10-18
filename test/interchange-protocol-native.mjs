/** Run retained client/contract fault proofs through native production public
 * interfaces. Only the legacy harness's module lookup is adapted; fixtures,
 * protocol transitions, service replies and assertions remain the same owner. */
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import {createTransferContract} from '../src/interchange/transfer-contract.js';
import {createSetupLinkCodec} from '../src/interchange/setup-link.js';
import identity from '../src/training/identity.js';
import {createInstallTransfer} from '../src/platform/install-transfer.js';
import metrics from '../src/training/metrics.js';
import {compiler} from '../src/training/generation.js';
import {createEntryRules} from '../src/training/authoring.js';
import {createWorkoutRules} from '../src/training/workout.js';
const require=createRequire(import.meta.url);
const catalog=require('../assets/exercise-catalog.json');
const entry=createEntryRules(catalog),workout=createWorkoutRules(catalog);
const contract=createTransferContract({compiler,entry,workout,metrics,catalog,crypto:webcrypto,TextEncoder,TextDecoder});
const transfer=createInstallTransfer({crypto:webcrypto,TextEncoder,TextDecoder,atob,btoa,now:()=>new Date().toISOString()});
for(const [path,api] of [['../install-transfer-contract.js',contract],['../install-transfer.js',transfer],['../shared-setup.js',createSetupLinkCodec({metrics,identity,capabilities:{TextEncoder,TextDecoder,CompressionStream,DecompressionStream,Blob,atob,btoa}})]]){
  const resolved=require.resolve(path);
  require.cache[resolved]={id:resolved,filename:resolved,loaded:true,exports:api};
}
await import('./install-transfer-client-contract.mjs');

await import('./install-transfer-client.mjs');
await import('./shared-setup-unit.mjs');
