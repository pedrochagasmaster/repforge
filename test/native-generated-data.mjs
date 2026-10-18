import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as exercises from '../exercises.js';
import {STRINGS} from '../i18n.js';
import {createI18n} from '../src/platform/i18n.js';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Captured through the original public CJS data interface at a0cfe244 before
// changing either generator; these are independent retained migration oracles.
assert.equal(hash(exercises.EXERCISE_LIBRARY),'bdee70873eb0ba0132cd8cffb107d9ab54bd74bfc4a3905bedeedb74f5557a6b');
assert.equal(hash(exercises.LEGACY_LIBRARY_IDS),'44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
assert.equal(hash(STRINGS.en),'efb27eb342435067b37ed142981a5ffc41313025b95157fa8f10429e41fb090a');
assert.equal(hash(STRINGS.pt),'4b9b41caf3c812fb0a05960e21258d537f5549c2b77690b8a63e648ba1575f9a');
assert.equal(exercises.library.length,1345);assert.equal(Object.keys(STRINGS.en).length,2767);
assert.equal(exercises.library,exercises.EXERCISE_LIBRARY);assert.equal(exercises.legacyIds,exercises.LEGACY_LIBRARY_IDS);
assert.equal(exercises.catalogSha256,'08945f092b708884f14e0bd87d7ac8ac79e2399a9c795fee8aeb2c106b2311b7');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/exercise-catalog.json',import.meta.url))).digest('hex'),exercises.catalogSha256);
let documentReads=0,navigatorReads=0;
const a=createI18n({strings:STRINGS,document:{get documentElement(){documentReads++;throw Error('explicit method only')}},navigator:{get language(){navigatorReads++;return 'pt-BR'}}});
const b=createI18n({strings:STRINGS,document:null,navigator:{language:'en-US'}});
assert.deepEqual([documentReads,navigatorReads],[0,0],'construction must not read browser capabilities');
assert.equal(a.detectLang(),'pt');assert.equal(navigatorReads,1);assert.equal(a.setLang('pt'),'pt');assert.equal(a.t('nav.log'),'Hoje');assert.equal(b.t('nav.log'),'Today');
assert.equal(b.t('program.export_text.days_per_week',{n:3}),'3 days/week');
assert.equal(a.t('literal.missing-key'),'literal.missing-key');assert.deepEqual(a.consumeMissingRequests(),['literal.missing-key']);assert.deepEqual(a.consumeMissingRequests(),[]);assert.deepEqual(b.consumeMissingRequests(),[]);
assert.equal(a.normalizeLang('pt-BR'),null);assert.equal(a.setLang('not-a-language'),'en');assert.equal(a.speechLang(),'en-US');
const priorDescriptors=Object.fromEntries(['window','document','navigator'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
for(const name of ['window','document','navigator'])Object.defineProperty(globalThis,name,{configurable:true,get(){throw Error('ambient browser read: '+name)}});
try{await import('../exercises.js?native-purity-proof');await import('../i18n.js?native-purity-proof');await import('../src/platform/i18n.js?native-purity-proof')}finally{for(const name of ['window','document','navigator']){if(priorDescriptors[name])Object.defineProperty(globalThis,name,priorDescriptors[name]);else delete globalThis[name]}}
console.log('PASS native generated data: exact independent corpus/dictionary hashes, catalog pin, zero import/construction browser IO and isolated language/missing requests');
