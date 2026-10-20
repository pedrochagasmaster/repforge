// Fixture builders share one write/check boundary. --check never rewrites a
// golden file; callers must investigate differences rather than accept drift.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function writeFixture(path,bytes,{check=process.argv.includes('--check')}={}) {
  if(check){
    const committed=readFileSync(path,'utf8');
    if(committed!==bytes)throw new Error(`Fixture bytes differ: ${path}. Inspect producer drift before regenerating.`);
    return 'verified';
  }
  const outputAt=process.argv.indexOf('--output');
  const destination=outputAt>=0?process.argv[outputAt+1]:path;
  if(!destination||destination.startsWith('--'))throw new TypeError('--output requires a file path');
  if(process.argv.includes('--generate-new')&&resolve(destination)===resolve(path))throw new Error('New generation cannot overwrite an immutable historical fixture');
  writeFileSync(destination,bytes);
  return 'regenerated';
}
