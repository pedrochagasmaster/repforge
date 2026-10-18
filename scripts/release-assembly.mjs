/** Native paths are mirrored unchanged: browser/Worker relative resolution stays native. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {releaseWorker} from './release-worker.mjs';
export function assembleRelease(out, {optional = []} = {}) {
  if (readdirSync(out).includes('releases')) throw new Error('Release assembly requires a fresh output directory');
  const files = [];
  const walk = dir => {
    for (const entry of readdirSync(join(out, dir),{withFileTypes:true})) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if(path !== 'sw.js') files.push(path);
    }
  };
  walk(''); files.sort();
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const hashes = files.map(path => [path, hash(readFileSync(join(out,path)))]);
  const id = hash(JSON.stringify(hashes)).slice(0,24);
  const base = `releases/${id}/`;
  const rootHtml = readFileSync(join(out,'index.html'),'utf8').replace(/\s*<meta\s+name="taurifer-release"\s+content="[^"]*"\s*\/?\s*>/g, '');
  // Prefix only local resource attributes. Links to app navigation and fragment
  // proposals stay at scope root; relative URLs *inside* code/CSS are untouched.
  const html = rootHtml.replace(/(<(?:script|link|img|source)\b[^>]*?\b(?:src|href)=")(?![a-z]+:|\/|#)([^"?]+)([^" ]*)(")/gi,
    (all,start,path,query,end) => path !== 'manifest.webmanifest' && files.includes(path) ? start+base+path+query+end : all)
    .replace('<head>',`<head>\n  <meta name="taurifer-release" content="${id}">`);
  writeFileSync(join(out,'index.html'),html);
  for (const path of files) {
    mkdirSync(dirname(join(out,base,path)),{recursive:true});
    // Preserve source shell as well as published shell. Worker serves the latter.
    copyFileSync(join(out,path),join(out,base,path));
  }
  const optionalSet = new Set(optional);
  const record = path => ({url:base+path,sha256:hash(readFileSync(join(out,base,path)))});
  const required = files.filter(path => !optionalSet.has(path)).map(record);
  const manifest = {version:1,id,required,optional:files.filter(path => optionalSet.has(path)).map(record)};
  writeFileSync(join(out,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  writeFileSync(join(out,'sw.js'),releaseWorker(manifest));
  return manifest;
}
