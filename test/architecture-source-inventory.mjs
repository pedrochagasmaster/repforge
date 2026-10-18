import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {nativeSourceAssets,sourceInventoryText} from '../scripts/native-source-assets.mjs';
test('native inventory has one filesystem authority and detects any new nested owner',()=> {
  const root=mkdtempSync(join(tmpdir(),'native-source-inventory-'));
  try {
    mkdirSync(join(root,'src/app'),{recursive:true});mkdirSync(join(root,'styles'),{recursive:true});
    writeFileSync(join(root,'src/app/browser.js'),'export const version=1;');
    writeFileSync(join(root,'src/app/types.d.ts'),'export type T=string;');
    writeFileSync(join(root,'styles/tokens.css'),':root{}');
    const shell='const ASSETS = [\n  // BEGIN GENERATED NATIVE SOURCE ASSETS\n  // END GENERATED NATIVE SOURCE ASSETS\n "./index.html"\n];';
    const generated=sourceInventoryText(root,shell);
    assert.deepEqual(nativeSourceAssets(root),['src/app/browser.js','styles/tokens.css']);
    assert.match(generated,/"\.\/src\/app\/browser.js",/);
    assert.equal(sourceInventoryText(root,generated),generated,'generation reaches fixed point');
    writeFileSync(join(root,'src/app/history.js'),'export const history=1;');
    assert.notEqual(sourceInventoryText(root,generated),generated,'new owner is an objective drift failure');
    assert.throws(()=>sourceInventoryText(root,'const ASSETS=[];'),/markers/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
