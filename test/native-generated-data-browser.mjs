import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from './browser.mjs';
import {browserLanguage,browserExerciseSource} from './language-browser.mjs';
const browser=await launchChromium();
try{
 const context=await browser.newContext();await context.addInitScript(()=>{
  window.__nativeDataAmbientRequests=[];
  for(const name of ['RepForgeI18n','RepForgeExercises'])Object.defineProperty(window,name,{configurable:true,get(){window.__nativeDataAmbientRequests.push('get:'+name);throw Error('Retired ambient data read: '+name)},set(){window.__nativeDataAmbientRequests.push('set:'+name);throw Error('Retired ambient data assignment: '+name)}});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.REPFORGE_URL||'http://localhost:8000/');await waitForAppBoot(page);
 await page.evaluate(()=>window.__repforgeStorage.flush());
 const durable=await page.evaluateHandle(()=>window.__repforgeStorage.durable),before=await page.evaluate(()=>localStorage.getItem('repforge_v1'));
 const language=await browserLanguage(page),source=await browserExerciseSource(page);
 assert.equal(await durable.evaluate(owner=>owner===window.__repforgeStorage.durable),true,'importing the exact language module cannot boot a second durable instance');
 assert.equal(await source.evaluate(source=>source.library===window.__repforgeExerciseLibrary),true,'the rendered exercise index uses the actual native data instance');
 assert.equal(await language.evaluate(language=>language.t('nav.log')),'Today');
 const translated=await language.evaluate(language=>{language.setLang('pt');language.applyDom();language.t('literal.native-missing');return{lang:language.getLang(),speech:language.speechLang(),text:language.t('nav.log'),root:document.documentElement.lang,missing:language.consumeMissingRequests().includes('literal.native-missing')}});
 assert.deepEqual(translated,{lang:'pt',speech:'pt-BR',text:'Hoje',root:'pt-BR',missing:true});
 assert.equal(await page.evaluate(()=>localStorage.getItem('repforge_v1')),before,'a transient language change does not write a durable setting');
 assert.deepEqual(await page.evaluate(()=>window.__nativeDataAmbientRequests),[],'production must never read or assign either retired global');assert.deepEqual(errors,[]);
 await context.close();console.log('PASS native generated production: poisoned globals, actual exercise instance, exact app module language, EN/PT and transient state');
}finally{await browser.close()}
