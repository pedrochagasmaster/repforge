/** Node test composition of production public interchange/training modules.
 * No schema, normalizer or protocol is implemented in this helper. */
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createSetupLinkCodec} from '../src/interchange/setup-link.js';
import {createTransferContract} from '../src/interchange/transfer-contract.js';
import {createInstallTransfer} from '../src/platform/install-transfer.js';
import {compiler} from '../src/training/generation.js';
import metrics from '../src/training/metrics.js';
import {createIdentityRules} from '../src/training/identity.js';
export const setupIdentity=createIdentityRules();
import {createEntryRules} from '../src/training/authoring.js';
import {createWorkoutRules} from '../src/training/workout.js';
export const catalog=JSON.parse(readFileSync(new URL('../assets/exercise-catalog.json',import.meta.url),'utf8'));
export const entry=createEntryRules(catalog),workout=createWorkoutRules(catalog);
export const capabilities={crypto:webcrypto,TextEncoder,TextDecoder,CompressionStream,DecompressionStream,Blob,atob,btoa,now:()=>new Date().toISOString()};
export function transferContract(overrides={}){
  return createTransferContract({compiler,entry,workout,metrics,catalog,crypto:webcrypto,TextEncoder,TextDecoder,...overrides});
}
export const Setup=createSetupLinkCodec({metrics,identity:setupIdentity,capabilities});
export const Contract=transferContract();
export const Transfer=createInstallTransfer(capabilities);

/** Execute the actual native public module graph in a distinct JS realm.
 * This retains the old Node/browser-loader parity boundary without maintaining
 * a second module format or evaluating private app helpers. */
export async function nativeContractRealm(){
  const vm=await import('node:vm');
  if(typeof vm.SourceTextModule!=='function'){
    const {spawnSync}=await import('node:child_process');
    const result=spawnSync(process.execPath,['--experimental-vm-modules',...process.execArgv,...process.argv.slice(1)],{stdio:'inherit'});
    process.exit(result.status??1);
  }
  const {fileURLToPath,pathToFileURL}=await import('node:url');
  const {resolve,dirname}=await import('node:path');
  const context=vm.createContext({TextEncoder,TextDecoder,crypto:webcrypto,catalogText:JSON.stringify(catalog)});
  const files=new Map();
  const load=url=>{
    if(files.has(url))return files.get(url);
    const module=new vm.SourceTextModule(readFileSync(fileURLToPath(url),'utf8'),{context,identifier:url});
    files.set(url,module);return module;
  };
  const linker=(specifier,ref)=>load(pathToFileURL(resolve(dirname(fileURLToPath(ref.identifier)),specifier)).href);
  const rootUrl=new URL('./interchange-native-realm-entry.mjs',import.meta.url).href;
  const source=`
    import {createTransferContract} from '../src/interchange/transfer-contract.js';
    import {compiler} from '../src/training/generation.js';
    import metrics from '../src/training/metrics.js';
    import {createEntryRules} from '../src/training/authoring.js';
    import {createWorkoutRules} from '../src/training/workout.js';
    const catalog=JSON.parse(globalThis.catalogText);
    export const contract=createTransferContract({compiler,metrics,entry:createEntryRules(catalog),
      workout:createWorkoutRules(catalog),catalog,crypto:globalThis.crypto,TextEncoder,TextDecoder});
    export const parse=text=>JSON.parse(text);
  `;
  const root=new vm.SourceTextModule(source,{context,identifier:rootUrl});
  await root.link(linker);await root.evaluate();
  return {contract:root.namespace.contract,parse:root.namespace.parse};
}
