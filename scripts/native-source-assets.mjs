/** One filesystem-derived inventory for native assembly and raw-source preview. */
import {existsSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export function nativeSourceAssets(root) {
  const files=[];
  const collect=directory=> {
    // CSS authoring sources produce the one root runtime asset, not precache duplicates.
    if(directory==='styles/source'||!existsSync(join(root,directory)))return;
    for(const entry of readdirSync(join(root,directory),{withFileTypes:true})) {
      const file=join(directory,entry.name).split('\\').join('/');
      if(entry.isDirectory())collect(file);
      else if(/\.(?:js|json|css)$/.test(file))files.push(file);
    }
  };
  collect('src');collect('styles');
  return files.sort();
}
export function sourceInventoryText(root,source) {
  const begin='  // BEGIN GENERATED NATIVE SOURCE ASSETS';
  const end='  // END GENERATED NATIVE SOURCE ASSETS';
  const start=source.indexOf(begin),stop=source.indexOf(end);
  if(start<0||stop<start)throw new Error('sw.js needs GENERATED NATIVE SOURCE ASSETS markers inside ASSETS');
  const lines=nativeSourceAssets(root).map(file=>'  '+JSON.stringify('./'+file)+',').join('\n');
  return source.slice(0,start)+begin+'\n'+lines+'\n'+source.slice(stop);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const root=resolve(import.meta.dirname,'..'),file=join(root,'sw.js'),old=readFileSync(file,'utf8');
  const next=sourceInventoryText(root,old);
  if(process.argv.includes('--write'))writeFileSync(file,next);
  else if(next!==old){console.error('Native source SW inventory drift; run node scripts/native-source-assets.mjs --write');process.exitCode=1;}
  else console.log('Native source SW inventory current');
}
