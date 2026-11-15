import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const revision='0b885a01a79de833df72eed726648bcf63da0b38';
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),revision);
assert.equal(execFileSync('git',['diff','--name-only'],{encoding:'utf8'}).trim(),'');
const path='svelte/features/room-layout/playback.ts';
const source=await readFile(path);
const built=await Bun.build({entrypoints:[path],target:'browser',format:'esm',minify:false,write:false});
assert(built.success);assert.equal(built.outputs.length,1);
const script=await built.outputs[0].text();
const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(req){return new URL(req.url).pathname==='/playback.js'?new Response(script,{headers:{'content-type':'text/javascript'}}):new Response('<!doctype html><title>Public animation ownership fixture</title>',{headers:{'content-type':'text/html'}})}});
let browser;
const report={scope:'Isolated actual-source Web Animations state/operation fixture; not production geometry, application acceptance or performance',revision,sourceSHA256:createHash('sha256').update(source).digest('hex'),status:'running',pageErrors:[]};
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu']});report.chromium=browser.version();
 const page=await browser.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));await page.goto(server.url.href);
 report.result=await page.evaluate(async()=>{
  const {createRoomPlayback}=await import(new URL('/playback.js',location.href).href);
  const check=(value,label)=>{if(!value)throw Error(label)};
  const style=document.createElement('style');style.textContent='@keyframes vb-room-viewport {from{opacity:.2}to{opacity:1}}';document.head.append(style);
  const target=document.createElement('div');target.textContent='fixture';document.body.append(target);target.style.animation='vb-room-viewport 1s linear infinite';
  const animation=target.getAnimations()[0];check(animation instanceof CSSAnimation,'Actual CSSAnimation missing');await animation.ready;
  const pause=Animation.prototype.pause, time=Object.getOwnPropertyDescriptor(Animation.prototype,'currentTime');check(time?.get&&time.set,'Native currentTime accessors missing');
  const counts=new WeakMap();let unavailable=0;const reads=[];
  const count=a=>{let v=counts.get(a);if(!v){v={pause:0,seek:0};counts.set(a,v)}return v};
  Animation.prototype.pause=function(){count(this).pause++;return pause.call(this)};
  Object.defineProperty(Animation.prototype,'currentTime',{...time,get:time.get,set(value){count(this).seek++;return time.set.call(this,value)}});
  const owner=createRoomPlayback(target,()=> 'vb-room-viewport',()=>unavailable++);
  try{
   owner.set(.4);check(animation.playState==='paused'&&!animation.pending&&animation.currentTime===400,'Initial settled seek');
   const settled={...count(animation)};owner.set(.4);check(JSON.stringify(count(animation))===JSON.stringify(settled),'Settled duplicate mutated animation');reads.push('settled-repeat-no-writes');
   animation.play();animation.pause();check(animation.pending&&animation.playState==='paused','Native pending pause precondition');const before=count(animation).seek;owner.set(.4);check(!animation.pending&&animation.currentTime===400&&count(animation).seek===before+1,'Pending pause not synchronously completed');reads.push('native-pending-pause-synchronously-settled');
   target.style.animation='none';target.getAnimations();target.style.animation='vb-room-viewport 1s linear infinite';const replacement=target.getAnimations()[0];check(replacement instanceof CSSAnimation&&replacement!==animation,'Native CSSAnimation replacement precondition');owner.set(.4);check(replacement.currentTime===400&&!replacement.pending&&replacement.playState==='paused','Replacement at equal progress ignored');reads.push('replacement-same-progress-seeks-new-animation');
   replacement.currentTime=7;owner.set(.4);check(replacement.currentTime===400,'External time not corrected');reads.push('external-time-corrected');
   const final={...count(replacement)};owner.dispose();owner.set(.7);check(JSON.stringify(count(replacement))===JSON.stringify(final),'Disposed owner mutated animation');check(unavailable===0,'Unexpected unavailable');reads.push('disposed-owner-inert');
   return {assertions:reads,first:count(animation),replacement:count(replacement),unavailable};
  }finally{owner.dispose();Animation.prototype.pause=pause;Object.defineProperty(Animation.prototype,'currentTime',time);target.remove();style.remove()}
 });
 assert.equal(report.pageErrors.length,0);report.status='passed';
}catch(e){report.status='failed';report.error=e.message;process.exitCode=1}
finally{await browser?.close();server.stop(true);report.closed=true;await writeFile(process.env.PLAYBACK_AUDIT_OUTPUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
