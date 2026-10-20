import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNotifications } from "../src/platform/notifications.js";
import { createFiles } from "../src/platform/files.js";
import { createTelemetry } from "../src/platform/telemetry.js";
import * as install from "../src/platform/install.js";
import { escapeHtml, formatNumber, formatClock } from "../src/ui/format.js";
// Characterized from install-policy.js at integration base 8cc88b73.
// Frozen oracle remains available after the legacy global module is deleted.
const outcomes=[];
for (const platform of ["ios", "chromium", "other"])
for (const count of [0, 1, 2, 3, 10])
for (const source of [undefined, "manual-settings"])
for (const standalone of [false, true])
for (const prefs of [{}, {installLastOfferedAt: 123, installLastOfferedMilestone: 1}, {installDismissedAt: 999999999, installDismissedMilestone: 3}]) {
  const input={platform,savedWorkoutsCount:count,source,standalone,uiPrefs:prefs,nowMs:10000000,hasInstallCapability:true,transferAvailable:true,hasMeaningfulData:count>0};
  outcomes.push(install.evaluateInstallPolicy(input));
}
assert.equal(createHash("sha256").update(JSON.stringify(outcomes)).digest("hex"), "b41927143030056680ccb3d70fd1c38bb3c8496623ae9e0ad51c6a48d12a5285");
assert.equal(install.evaluateInstallPolicy({platform:"chromium",hasInstallCapability:true,savedWorkoutsCount:0,nowMs:1}).state,"chromium-awaiting-value");
assert.equal(install.evaluateInstallPolicy({platform:"ios",standalone:true,nowMs:1}).state,"already-installed");
let readyRead=false;
let shown=0;
const navigator={serviceWorker:{get ready(){readyRead=true;throw Error("must not wait")},async getRegistration(){return {showNotification:async()=>shown++}}}};
class Notification { static permission="granted"; }
const notify=createNotifications({Notification,navigator});
assert.equal(await notify.fireOS({title:"Timer"}),true);
assert.equal(shown,1);assert.equal(readyRead,false);
assert.equal(await createNotifications().fireOS({}),false);
assert.equal(notify.enabledFor({notify:{enabled:true,timer:true}},"timer"),true);
assert.equal(notify.enabledFor({notify:{enabled:true}},"unknown"),false);
const calls=[];
const anchor={remove(){calls.push("remove")},click(){calls.push("click");throw Error("blocked")}};
const files=createFiles({document:{body:{append(){calls.push("append")}},createElement:()=>anchor},navigator:{},URL:{createObjectURL:()=>"blob:x",revokeObjectURL:()=>calls.push("revoke")},Blob:class {},File:class {}});
assert.throws(()=>files.download("a","b"),/blocked/);
assert.deepEqual(calls,["append","click","remove","revoke"]);
const first=createTelemetry(),second=createTelemetry();
first.setEnabled(false);
assert.equal(first.isEnabled(),false);assert.equal(second.isEnabled(),true);
assert.equal(escapeHtml('<"&'),"&lt;&quot;&amp;");assert.equal(formatNumber(12.5,"pt"),"12,5");assert.equal(formatClock(61),"1:01");
console.log("platform modules: install parity (180 cases), notification no-ready fallback, file cleanup and telemetry lifetime isolation passed");
