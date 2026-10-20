import assert from 'node:assert/strict';
import {createNotifications} from '../src/platform/notifications.js';
const adapter={canUse:()=>true,permission:()=> 'granted'};
let delivered=[];
const serviceWorker={get ready(){throw Error('delivery must not await ready')},async getRegistration(){return{showNotification:async(title,options)=>delivered.push({title,options})}}};
assert.equal(await createNotifications({adapter,navigator:{serviceWorker}}).fireOS({title:'Rest finished',body:'Next set',tag:'rest',url:'./#focus'}),true);
assert.deepEqual(delivered,[{title:'Rest finished',options:{body:'Next set',tag:'rest',renotify:true,data:{url:'./#focus'},icon:'./icons/icon-192.png',badge:'./icons/icon-192.png'}}]);
assert.equal(await createNotifications({adapter,console:{warn(){}}}).fireOS({}),false,'adapter permission does not invent a constructor or registration');
assert.equal(await createNotifications({adapter:{...adapter,permission:()=> 'denied'},navigator:{serviceWorker}}).fireOS({}),false);
assert.equal(delivered.length,1,'denial never reaches delivery');
let constructed=[];class Notification{static permission='granted';constructor(title,options){constructed.push({title,options})}}
assert.equal(await createNotifications({Notification,navigator:{serviceWorker:{async getRegistration(){throw Error('registration failed')}}}}).fireOS({title:'Fallback'}),true);
assert.equal(constructed.length,1);assert.equal(constructed[0].title,'Fallback');
console.log('PASS adapter-only SW delivery, missing transport refusal, permission denial and failed-registration constructor fallback');
