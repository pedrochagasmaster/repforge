import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {buildStyles} from '../tools/build-styles.mjs';
import {STYLE_SOURCES} from '../tools/styles-order.mjs';
import {nativeSourceAssets} from '../scripts/native-source-assets.mjs';
const root=resolve(import.meta.dirname,'..'),fixture=mkdtempSync(join(tmpdir(),'taurifer-styles-'));
try{
 for(const file of [...STYLE_SOURCES,'styles.css']){mkdirSync(dirname(join(fixture,file)),{recursive:true});copyFileSync(join(root,file),join(fixture,file))}
 const original=readFileSync(join(fixture,'styles.css'));
 buildStyles(fixture,{check:true});
 const changed=join(fixture,STYLE_SOURCES[0]),source=readFileSync(changed);
 writeFileSync(changed,Buffer.concat([source,Buffer.from('\n:root{--literal-drift-control:17}\n')]));
 assert.throws(()=>buildStyles(fixture,{check:true}),/Generated styles\.css drift/,'a real source change must refuse stale runtime CSS');
 assert.deepEqual(readFileSync(join(fixture,'styles.css')),original,'check mode cannot quietly regenerate the baseline');
 writeFileSync(changed,source);buildStyles(fixture,{check:true});
 const orphan=join(fixture,'styles/source/unordered.css');writeFileSync(orphan,'body{color:red}\n');
 assert.throws(()=>buildStyles(fixture,{check:true}),/Unordered stylesheet source/,'an unlisted CSS source cannot silently disappear from the runtime asset');
 rmSync(orphan);buildStyles(fixture);assert.deepEqual(readFileSync(join(fixture,'styles.css')),original,'a normal rebuild preserves the prior runtime bytes');
 assert.equal(nativeSourceAssets(root).some(path=>path.startsWith('styles/source/')),false,'authoring CSS is excluded from release/precache publication');
 console.log('PASS stylesheet generation: actual drift refuses stale bytes, check is read-only, orphan sources fail and build sources stay private');
}finally{rmSync(fixture,{recursive:true,force:true})}
