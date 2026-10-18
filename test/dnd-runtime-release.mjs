import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped lazy loader without a worker rewriting document-relative
// requests. The release URL and expected sibling are independent literals.
const scripts=[];
const document={
 currentScript:{src:'https://example.test/taurifer/releases/immutable-A/vendor/dnd-kit/dnd-kit.js?v=480'},
 readyState:'loading',addEventListener(){},
 createElement(){return {dataset:{}}},head:{append(script){scripts.push(script)}}
};
const window={};
vm.runInNewContext(readFileSync(new URL('../vendor/dnd-kit/dnd-kit.js',import.meta.url),'utf8'),{window,document,URL,setTimeout});
// document.currentScript is only valid while the bootstrap itself executes.
document.currentScript=null;
const first=window.RepForgeDndRuntime.load(),second=window.RepForgeDndRuntime.load();
assert.equal(first,second,'concurrent loads share the actual pending operation');
assert.equal(scripts.length,1);
assert.equal(scripts[0].src,'https://example.test/taurifer/releases/immutable-A/vendor/dnd-kit/dnd-kit.runtime.js');
window.DndKit={DragDropManager:class {}};scripts[0].onload();
assert.equal(await first,window.DndKit);
assert.equal(await window.RepForgeDndRuntime.load(),window.DndKit);
assert.equal(scripts.length,1);
console.log('PASS shipped Dnd loader retains its immutable sibling URL after currentScript disappears');
