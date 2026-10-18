#!/usr/bin/env node
/** AST-based native-module boundary checker. Run after npm ci --prefix tools/typecheck. */
import ts from './typecheck/node_modules/typescript/lib/typescript.js';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve, relative, dirname, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const ROOT = resolve(import.meta.dirname, '..');
const layer = file => file.split('/')[0];
const permitted = {training:['training'], persistence:['persistence','training'], platform:['platform'], ui:['ui','training'], app:['app','training','persistence','platform','ui'], release:['release'], compat:['compat','app','training','persistence','platform','ui','release']};
const io = new Set(['window','document','localStorage','sessionStorage','indexedDB','fetch','Worker','navigator','setTimeout','setInterval']);
/** Also exported so seeded negative tests exercise the real checker. */
export function inspectModules(sources) {
  const errors = [], edges = new Map();
  for (const [file, source] of Object.entries(sources)) {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const deps = [];
    const inspect = node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const spec = node.moduleSpecifier;
        if (spec && ts.isStringLiteral(spec)) {
          if (!spec.text.startsWith('.')) errors.push(`${file}: non-relative runtime import ${spec.text}`);
          else {
            const target = relative('/src', resolve('/src', dirname(file), spec.text)).split(sep).join('/');
            deps.push(target);
            if (!sources[target]) errors.push(`${file}: missing import ${target}`);
            if (!permitted[layer(file)]?.includes(layer(target))) errors.push(`${file}: forbidden direction to ${target}`);
            if (layer(file) !== layer(target) && !/\/(?:index|public)\.js$/.test(target)) errors.push(`${file}: bypasses public entry ${target}`);
          }
        }
      }
      if (layer(file) === 'training' && ts.isIdentifier(node) && io.has(node.text)) errors.push(`${file}: domain IO ${node.text}`);
      if (ts.isExpressionStatement(node) && node.parent === ast && !ts.isStringLiteral(node.expression)) errors.push(`${file}: import-time effect`);
      if (ts.isVariableDeclaration(node) && node.initializer && node.parent.parent?.parent === ast && containsCall(node.initializer)) errors.push(`${file}: import-time initializer call`);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && !ts.isStringLiteral(node.arguments[0])) errors.push(`${file}: non-literal dynamic import`);
      ts.forEachChild(node, inspect);
    };
    inspect(ast); edges.set(file, deps);
  }
  const active = new Set(), done = new Set();
  const visit = file => {
    if (active.has(file)) { errors.push(`${file}: dependency cycle`); return; }
    if (done.has(file)) return;
    active.add(file); for (const next of edges.get(file) || []) visit(next); active.delete(file); done.add(file);
  };
  for (const file of edges.keys()) visit(file);
  return [...new Set(errors)];
}
function containsCall(node) {
  if (ts.isFunctionLike(node)) return false;
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) return true;
  return !!ts.forEachChild(node, containsCall);
}
function gather(dir) {
  if (!existsSync(dir)) return {};
  return Object.assign({}, ...readdirSync(dir, {withFileTypes:true}).map(entry => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? gather(path) : entry.name.endsWith('.js') ? {[relative(resolve(ROOT,'src'),path).split(sep).join('/')]:readFileSync(path,'utf8')} : {};
  }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = inspectModules(gather(resolve(ROOT,'src')));
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('Architecture module boundaries passed');
}
