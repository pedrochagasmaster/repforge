#!/usr/bin/env node
/** AST-based native-module boundary checker. Run after npm ci --prefix tools/typecheck. */
import ts from './typecheck/node_modules/typescript/lib/typescript.js';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve, relative, dirname, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const ROOT = process.argv.includes('--root') ? resolve(process.argv[process.argv.indexOf('--root')+1]) : resolve(import.meta.dirname, '..');
const layer = file => file.split('/')[0];
const permitted = {training:['training'], persistence:['persistence','training'], interchange:['interchange','training'], platform:['platform','training','interchange'], ui:['ui','app','training'], app:['app','training','persistence','interchange','platform'], release:['release'], compat:['compat','app','training','persistence','interchange','platform','ui','release']};
// Purpose-specific public entries, not generic pass-through barrels.
const publicEntries = new Set([
  ...['metrics','identity','model','generation','authoring','workout','progress'].map(name=>`training/${name}.js`),
  ...['durable','snapshot','preferences','setup-draft'].map(name=>`persistence/${name}.js`),
  ...['backup','program-file','freeform','setup-link','csv','transfer-contract','program-text'].map(name=>`interchange/${name}.js`),
  ...['catalog','program-executor','files','notifications','telemetry','install-transfer','motion','install'].map(name=>`platform/${name}.js`),
  ...['session','workout','program','history','entry','interchange','settings','read-models','history-read-models','review','block-transition','progress-read-models','workout-model','storage-recovery','custom-import','block-review','program-sharing'].map(name=>`app/${name}.js`),
  'release/gate.js', 'ui/storage-recovery.js','ui/shell.js','ui/format.js','ui/editors.js',
  ...['today','workout','focus','history','progress','entry','program','library','settings'].map(name=>`ui/${name}/controller.js`),
]);
const compositionRoots = new Set(['app/browser.js','platform/program-worker.js','compat/bootstrap.js']);
const io = new Set(['globalThis','global','self','window','document','localStorage','sessionStorage','indexedDB','fetch','Worker','navigator','setTimeout','setInterval']);
/** Also exported so seeded negative tests exercise the real checker. */
export function inspectModules(sources) {
  const errors = [], edges = new Map();
  // Resolve actual lexical bindings: an editor parameter named `document` is
  // domain data, while an unbound DOM `document` is forbidden browser IO.
  const syntax = new Map(Object.entries(sources).map(([file,source])=>[resolve('/src',file),ts.createSourceFile(resolve('/src',file),source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS)]));
  const options={allowJs:true,noLib:true,noResolve:true,target:ts.ScriptTarget.Latest};
  const host=ts.createCompilerHost(options);
  host.getSourceFile=file=>syntax.get(resolve(file));
  host.fileExists=file=>syntax.has(resolve(file));
  host.readFile=file=>sources[relative('/src',resolve(file)).split(sep).join('/')];
  const bindings=ts.createProgram([...syntax.keys()],options,host).getTypeChecker();
  for (const [file] of Object.entries(sources)) {
    const ast = syntax.get(resolve('/src',file));
    for(const diagnostic of ast.parseDiagnostics) errors.push(`${file}: syntax ${ts.flattenDiagnosticMessageText(diagnostic.messageText,' ')}`);
    const readonlyCollections = discoverReadonlyCollections(ast);
    const deps = [];
    const inspect = node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)) {
        const spec = ts.isCallExpression(node) ? node.arguments[0] : node.moduleSpecifier;
        if (spec && ts.isStringLiteral(spec)) {
          if (!spec.text.startsWith('.')) errors.push(`${file}: non-relative runtime import ${spec.text}`);
          else {
            const target = relative('/src', resolve('/src', dirname(file), spec.text)).split(sep).join('/');
            deps.push(target);
            if (!sources[target]) errors.push(`${file}: missing import ${target}`);
            if (!((file === 'app/browser.js' || file === 'compat/bootstrap.js') || permitted[layer(file)]?.includes(layer(target)))) errors.push(`${file}: forbidden direction to ${target}`);
            if (file.startsWith('ui/') && target.startsWith('ui/') && file.split('/').length > 2 && target.split('/').length > 2 && file.split('/')[1] !== target.split('/')[1]) errors.push(`${file}: cross-feature private import ${target}`);
            if (layer(file) !== layer(target) && !publicEntries.has(target) && !compositionRoots.has(target)) errors.push(`${file}: bypasses public entry ${target}`);
          }
        }
      }
      if (ts.isPropertyAccessExpression(node) && /^RepForge/.test(node.name.text) && ts.isIdentifier(node.expression) && ['window','globalThis','self','global'].includes(node.expression.text) && layer(file) !== 'compat') errors.push(`${file}: global module lookup`);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') errors.push(`${file}: dynamic require`);
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['Date.now','Math.random'].includes(node.expression.getText(ast)) && layer(file) === 'training') errors.push(`${file}: implicit nondeterminism`);
      if (layer(file) === 'training' && ts.isIdentifier(node) && io.has(node.text) && !bindings.getSymbolAtLocation(node)?.declarations?.length && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name===node) && !(ts.isPropertyAssignment(node.parent) && node.parent.name===node)) errors.push(`${file}: domain IO ${node.text}`);
      if (!compositionRoots.has(file) && ts.isExpressionStatement(node) && node.parent === ast && !ts.isStringLiteral(node.expression) && containsCall(node.expression)) errors.push(`${file}: import-time effect`);
      if (!compositionRoots.has(file) && ts.isVariableDeclaration(node) && node.initializer && node.parent.parent?.parent === ast && !readonlyCollections.has(node.name.getText(ast)) && containsCall(node.initializer)) errors.push(`${file}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1}: import-time initializer call ${node.name.getText(ast)}`);
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
  if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) return true;
  if (ts.isDeleteExpression(node) || ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(node.operator))) return true;
  if (ts.isCallExpression(node)) {
    const callee = node.expression;
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text==='JSON' && callee.name.text==='stringify') return node.arguments.some(containsCall);
    if (ts.isIdentifier(callee) && callee.text === 'Symbol') return node.arguments.some(containsCall);
    if (ts.isPropertyAccessExpression(callee) && ['map','flatMap','flat','filter'].includes(callee.name.text)) {
      return containsCall(callee.expression) || node.arguments.some((argument,index) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument) ? containsCall(argument.body) : (index===0 && callee.name.text!=='flat' ? true : containsCall(argument)));
    }
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'Object' && ['freeze','fromEntries','keys','values','entries'].includes(callee.name.text)) return node.arguments.some(containsCall);
    return true;
  }
  if (ts.isNewExpression(node)) {
    if(ts.isIdentifier(node.expression) && node.expression.text==='URL' && ts.isPropertyAccessExpression(node.parent) && node.parent.name.text==='href') return (node.arguments || []).some(containsCall);
    return true;
  }
  return !!ts.forEachChild(node, containsCall);
}
// Fixed lookup collections are allowed only when private and all uses are
// structurally read-only. Mutation, aliasing, export and passing to another
// function fail closed; WeakMap/WeakSet never qualify (owned lifetime required).
function discoverReadonlyCollections(ast) {
  const candidates = new Map();
  for(const statement of ast.statements) {
    if(!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const) || statement.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword)) continue;
    for(const declaration of statement.declarationList.declarations) {
      const init=declaration.initializer;
      if(ts.isIdentifier(declaration.name) && init && ts.isNewExpression(init) && ts.isIdentifier(init.expression) && ['Map','Set'].includes(init.expression.text) && !(init.arguments || []).some(containsCall)) candidates.set(declaration.name.text,declaration.name);
    }
  }
  const readMethods=new Set(['get','has','keys','values','entries','size']);
  const localFunctions=new Map(ast.statements.filter(ts.isFunctionDeclaration).filter(node=>node.name).map(node=>[node.name.text,node]));
  const readonlyArgument=(call,index)=> {
    if(!ts.isIdentifier(call.expression)) return false;
    const fn=localFunctions.get(call.expression.text), parameter=fn?.parameters[index];
    if(!parameter || !ts.isIdentifier(parameter.name)) return false;
    let safe=true;
    const inspectParameter=node=> {
      if(ts.isIdentifier(node)&&node.text===parameter.name.text&&node!==parameter.name) {
        const parent=node.parent;
        if(!(ts.isPropertyAccessExpression(parent)&&parent.expression===node&&readMethods.has(parent.name.text))) safe=false;
      }
      ts.forEachChild(node,inspectParameter);
    };
    inspectParameter(fn.body);
    return safe;
  };
  const inspect=node=> {
    if(ts.isIdentifier(node) && candidates.has(node.text) && candidates.get(node.text)!==node) {
      const parent=node.parent;
      const readProperty=ts.isPropertyAccessExpression(parent) && parent.expression===node && readMethods.has(parent.name.text) && !(ts.isBinaryExpression(parent.parent) && parent.parent.left===parent);
      const iteration=ts.isSpreadElement(parent) || (ts.isForOfStatement(parent) && parent.expression===node);
      const checkedLocalCall=ts.isCallExpression(parent) && readonlyArgument(parent,parent.arguments.indexOf(node));
      if(!readProperty&&!iteration&&!checkedLocalCall) candidates.delete(node.text);
    }
    ts.forEachChild(node,inspect);
  };
  inspect(ast);
  return new Set(candidates.keys());
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
