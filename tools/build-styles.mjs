#!/usr/bin/env node
/** Retain one browser stylesheet and its exact cascade/URL base. No transforms. */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {STYLE_SOURCES} from './styles-order.mjs';

export function buildStyles(root,{check=false}={}){
  const actual=[];
  function visit(directory){for(const entry of readdirSync(join(root,directory),{withFileTypes:true})){
    const path=directory+'/'+entry.name;
    if(entry.isDirectory())visit(path);else if(entry.name.endsWith('.css'))actual.push(path);
  }}
  visit('styles/source');
  if(new Set(STYLE_SOURCES).size!==STYLE_SOURCES.length)throw new Error('Duplicate stylesheet source in tools/styles-order.mjs');
  const expected=new Set(STYLE_SOURCES),orphans=actual.filter(path=>!expected.has(path));
  if(orphans.length)throw new Error('Unordered stylesheet source: '+orphans.join(', '));
  const bytes=Buffer.concat(STYLE_SOURCES.map(path=>readFileSync(join(root,path))));
  const target=join(root,'styles.css');
  if(check){if(!readFileSync(target).equals(bytes))throw new Error('Generated styles.css drift; run node tools/build-styles.mjs');}
  else writeFileSync(target,bytes);
  return{files:STYLE_SOURCES.length,bytes:bytes.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{const result=buildStyles(resolve(import.meta.dirname,'..'),{check:process.argv.includes('--check')});console.log(`Stylesheet ${process.argv.includes('--check')?'current':'generated'}: ${result.files} sources, ${result.bytes} bytes`);}
  catch(error){console.error(error.message);process.exitCode=1;}
}
