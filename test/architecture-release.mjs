import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectModules} from '../tools/check-architecture.mjs';
import {assembleRelease} from '../scripts/release-assembly.mjs';
import {startRelease,controllerMatches} from '../src/release/gate.js';

test('AST boundary checker accepts pure public contracts and rejects seeded violations',()=> {
  const good={'training/index.js':'export const add = (a,b) => a+b;', 'app/index.js':"import {add} from '../training/index.js'; export const command = () => add(1,2);"};
  assert.deepEqual(inspectModules(good),[]);
  const rejects = [
    [{'training/index.js':"import '../ui/index.js';",'ui/index.js':'export const ui = 1;'}, /forbidden direction/],
    [{'app/index.js':"import '../training/private.js';",'training/private.js':'export const value = 1;'}, /public entry/],
    [{'training/index.js':"export const a=()=>localStorage.getItem('x');"}, /domain IO/],
    [{'training/index.js':"fetch('/exfiltrate');"}, /import-time effect/],
    [{'training/index.js':'const n = Date.now();'}, /initializer call/],
    [{'training/index.js':"import './b.js';",'training/b.js':"import './index.js';"}, /cycle/],
  ];
  for(const [fixture,pattern] of rejects) assert.match(inspectModules(fixture).join('\n'),pattern);
});

test('startup refuses historical/mismatched controllers before loading and permits no-SW',async()=> {
  let calls=0; const load=async()=>{calls++;};
  assert.equal(await startRelease({releaseId:'r1',load}),'started');
  assert.equal(calls,1);
  const controller={postMessage(_message,ports){ports[0].postMessage({type:'taurifer-release',id:'old'});}};
  assert.equal(await startRelease({controller,releaseId:'r1',load}),'update-required');
  assert.equal(calls,1);
  assert.equal(await controllerMatches({postMessage(){}},'r1',5),false);
  assert.equal(await controllerMatches({postMessage(_m,p){p[0].postMessage({type:'taurifer-release',id:'r1'});}},'r1'),true);
  await assert.rejects(startRelease({releaseId:'r1',load:async()=>{throw Error('bad graph');}}),/bad graph/);
});

test('assembly preserves native relative graph, fingerprints all bytes and isolates public release',()=> {
  const dir=mkdtempSync(join(tmpdir(),'taurifer-release-'));
  try {
    mkdirSync(join(dir,'src'),{recursive:true});
    writeFileSync(join(dir,'index.html'),'<head></head><script type="module" src="src/main.js"></script><a href="#setup=private">proposal</a>');
    writeFileSync(join(dir,'src/main.js'),"import './leaf.js';");
    writeFileSync(join(dir,'src/leaf.js'),'export const n = 1;');
    const manifest=assembleRelease(dir);
    assert.match(readFileSync(join(dir,'index.html'),'utf8'),new RegExp(`src="releases/${manifest.id}/src/main.js"`));
    assert.match(readFileSync(join(dir,'index.html'),'utf8'),/href="#setup=private"/);
    assert.equal(readFileSync(join(dir,`releases/${manifest.id}/src/main.js`),'utf8'),"import './leaf.js';");
    for(const asset of manifest.required) assert.equal(createHash('sha256').update(readFileSync(join(dir,asset.url))).digest('hex'),asset.sha256);
    const worker=readFileSync(join(dir,'sw.js'),'utf8');
    assert.doesNotMatch(worker,/self\.skipWaiting\(|clients\.claim\(/);
    assert.match(worker,/sha256/);
    assert.match(worker,/pathname\.startsWith\('\/v1\/'\)/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('real generated worker rejects corrupt required bytes and serves only installed release',async()=> {
  const {runInNewContext}=await import('node:vm');
  const {webcrypto}=await import('node:crypto');
  const {releaseWorker}=await import('../scripts/release-worker.mjs');
  const content='export const version = 1;';
  const asset={url:'releases/r1/src/main.js',sha256:createHash('sha256').update(content).digest('hex')};
  const handlers={},storage=new Map(); let corrupt=false,deleted=0;
  const cache={async put(url,response){storage.set(url,response);},async match(url){return storage.get(url)?.clone();}};
  runInNewContext(releaseWorker({version:1,id:'r1',required:[asset]}),{
    self:{registration:{scope:'https://app.test/scoped/'},addEventListener(type,fn){handlers[type]=fn;}},
    URL,Response,Uint8Array,crypto:webcrypto,Promise,
    caches:{async open(){return cache;},async delete(){deleted++;storage.clear();}},
    async fetch(){return new Response(corrupt?'wrong bytes':content);},
  });
  const dispatch=async type=>{let task;handlers[type]({waitUntil(value){task=value;}});await task;};
  await dispatch('install');
  let response;
  handlers.fetch({request:{method:'GET',url:'https://app.test/scoped/src/main.js',mode:'cors'},respondWith(value){response=value;}});
  assert.equal(await (await response).text(),content);
  // A missing installed asset fails closed: there is no network version fallback.
  storage.clear();
  handlers.fetch({request:{method:'GET',url:'https://app.test/scoped/src/main.js',mode:'cors'},respondWith(value){response=value;}});
  assert.equal((await response).status,503);
  let intercepted=false;
  handlers.fetch({request:{method:'GET',url:'https://app.test/v1/transfer/private-token',mode:'cors'},respondWith(){intercepted=true;}});
  assert.equal(intercepted,false);
  corrupt=true;
  await assert.rejects(dispatch('install'),/integrity/);
  assert.equal(deleted,1);
  let reply;
  handlers.message({data:{type:'taurifer-release-query'},ports:[{postMessage(value){reply=value;}}]});
  assert.equal(reply.id,'r1');
});
