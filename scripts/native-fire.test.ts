import { expect,test } from "bun:test";
import { get } from "svelte/store";
import { createFireController } from "../svelte/features/composer/fire";
import type { ComposerFirePort,FireReport } from "../svelte/features/composer/fireTypes";
import type { FireCapture,FireCaptureFactory } from "../svelte/features/composer/fireAudio";
import { FireFailure } from "../svelte/features/composer/fireApi";
import { createMicrophoneGesture } from "../svelte/features/composer/microphone";
import { createSpeechController,type SpeechRecognizer } from "../svelte/features/composer/speech";
import type { Room } from "../shared/room";
import type { RoomCommand,CommandOutcome } from "../shared/commands";
import { manualClock,deferred,settle } from "./native-home-fixtures";
function microphone(){
  let ended=()=>{},chunk=(_value:Blob)=>{};
  const counts={starts:0,stops:0,disposed:0};
  const capture:FireCapture={type:"audio/webm",start(data,stop){counts.starts++;chunk=data;ended=stop;},stop(){counts.stops++;ended();},dispose(){counts.disposed++;}};
  return {capture,counts,chunk:(size=3000)=>chunk(new Blob([new Uint8Array(size)])),ended:()=>ended()};
}
function fixture(options:{capture?:FireCaptureFactory;transcribe?:ComposerFirePort["transcribe"];request?:(command:RoomCommand)=>Promise<CommandOutcome>}={}){
  const timer=manualClock(),mics:ReturnType<typeof microphone>[]=[],commands:RoomCommand[]=[],toggles:boolean[]=[],leaving=new Set<()=>void>();
  const engines:SpeechRecognizer[]=[];
  let room:Room={id:"abc123",me:"me@test",book:{title:"Owned room",owner:"me@test"},members:["me@test"],epics:[],messages:[],online:[],typing:{},suggestions:[]};
  let allowed=true,report:((value:FireReport)=>void)|null=null,denied=0,lost=0;
  const owner=createFireController({roomId:room.id,thread:"main",room:()=>room,locale:"en-US",clock:timer.clock,
    capture:options.capture??(async()=>{const mic=microphone();mics.push(mic);return mic.capture;}),
    factory:()=>{const rec:SpeechRecognizer={lang:"",continuous:false,interimResults:false,onresult:null,onerror:null,onend:null,start(){},stop(){},abort(){}};engines.push(rec);return rec;},
    request:async command=>{commands.push(command);return options.request?.(command)??{ok:true};},
    port:{current:()=>allowed,set:async on=>{toggles.push(on);},restore:async()=>{toggles.push(false);},
      transcribe:options.transcribe??(async()=>"Whisper owned utterance"),
      watch:callback=>{report=callback;return()=>{report=null;};},beforeLeave:callback=>{leaving.add(callback);return()=>{leaving.delete(callback);};},
      sessionLost(){lost++;allowed=false;},denyMembership(){denied++;allowed=false;},
    },
  });
  const canonical=(text="Whisper owned utterance")=>{room={...room,messages:[...room.messages,{id:room.messages.length+1,thread:"main",author:room.me,text,ts:1}]};owner.sync();};
  return {owner,timer,mics,commands,toggles,engines,canonical,
    get room(){return room;},set room(value:Room){room=value;},get lost(){return lost;},get denied(){return denied;},
    report(state:FireReport["state"]){report?.({t:"fireState",book:room.id,state,model:"haiku",note:""});},
    deny(){allowed=false;owner.sync();},leave(){for(const callback of [...leaving])callback();},
  };
}
test("record/release uses Whisper and normal message; ACK alone is not delivered",async()=>{
  const f=fixture();await f.owner.hold();await settle();
  expect(f.toggles).toEqual([true]);expect(f.mics[0].counts.starts).toBe(1);
  f.report("ready");expect(get(f.owner.state).phase).toBe("ready");
  f.mics[0].chunk();f.owner.release();await settle();
  expect(f.commands).toEqual([{t:"msg",text:"Whisper owned utterance",thread:"main"}]);
  expect(get(f.owner.state).sending).toBe("message");
  f.canonical();expect(get(f.owner.state).sending).toBe("none");expect(get(f.owner.state).sent).toBe("Whisper owned utterance");
  expect(f.mics[0].counts.disposed).toBe(1);f.owner.dispose();
});
test("small taps do not transcribe and browser preview never sends before release",async()=>{
  let reads=0;const f=fixture({transcribe:async()=>{reads++;return "server";}});await f.owner.hold();
  f.engines[0].onresult?.({results:[{0:{transcript:"preview"}}]});await settle();
  expect(get(f.owner.state).text).toBe("preview");expect(f.commands).toHaveLength(0);
  f.mics[0].chunk(1999);f.owner.release();await settle();expect(reads).toBe(0);expect(f.commands).toHaveLength(0);f.owner.dispose();
});
test("Whisper failure falls back to this utterance preview, with room language hints",async()=>{
  const seen:{lang:string;prompt:string}[]=[];
  const f=fixture({transcribe:async(_audio,query)=>{seen.push(query);throw Error("offline");}});await f.owner.hold();
  f.engines[0].onresult?.({results:[{0:{transcript:"owned preview"}}]});f.mics[0].chunk();f.owner.release();await settle();
  expect(seen[0].lang).toBe("en");expect(seen[0].prompt).toContain("Owned room");
  expect(f.commands).toEqual([{t:"msg",text:"owned preview",thread:"main"}]);f.owner.dispose();
});
test("release before microphone permission arrives disposes late capture without recording",async()=>{
  const permission=deferred<FireCapture>(),mic=microphone();const f=fixture({capture:()=>permission.promise});
  const hold=f.owner.hold();await settle();f.owner.release();permission.resolve(mic.capture);await hold;await settle();
  expect(mic.counts.disposed).toBe(1);expect(mic.counts.starts).toBe(0);expect(f.commands).toHaveLength(0);f.owner.dispose();
});
test("permission deadline fences ignored-abort late microphone results",async()=>{
  const permission=deferred<FireCapture>(),mic=microphone();const f=fixture({capture:()=>permission.promise});
  const hold=f.owner.hold();await settle();f.timer.advance(20000);await hold;
  permission.resolve(mic.capture);await settle();expect(mic.counts.disposed).toBe(1);expect(mic.counts.starts).toBe(0);f.owner.dispose();
});
test("Escape/leave stops media and discards late transcription; off confirmation is separate",async()=>{
  const response=deferred<string>();const f=fixture({transcribe:()=>response.promise});await f.owner.hold();f.mics[0].chunk();f.owner.release();await settle();
  f.owner.stop();expect(get(f.owner.state).phase).toBe("leaving");expect(f.toggles).toEqual([true,false]);
  response.resolve("late");await settle();expect(f.commands).toHaveLength(0);
  f.report("ready");expect(get(f.owner.state).phase).toBe("leaving");
  f.timer.advance(30000);expect(get(f.owner.state).error).toBe("restore");
  f.report("off");expect(get(f.owner.state).phase).toBe("idle");f.owner.dispose();
});
test("membership loss and synchronous scope departure revoke every capture callback",async()=>{
  const f=fixture();await f.owner.hold();const late=f.engines[0].onresult;f.deny();
  late?.({results:[{0:{transcript:"private late"}}]});f.mics[0].chunk();f.mics[0].ended();await settle();
  expect(f.mics[0].counts.disposed).toBe(1);expect(f.commands).toHaveLength(0);expect(get(f.owner.state).text).toBe("");
  f.owner.dispose();const next=fixture();await next.owner.hold();next.leave();expect(next.toggles).toEqual([true,false]);expect(next.mics[0].counts.disposed).toBe(1);next.owner.dispose();
});
test("oversized or spontaneously stopped recordings never upload or send",async()=>{
  let uploads=0;const f=fixture({transcribe:async()=>{uploads++;return "wrong";}});await f.owner.hold();f.mics[0].chunk(4_000_001);await settle();
  expect(get(f.owner.state).error).toBe("recording");expect(uploads).toBe(0);
  await f.owner.hold();f.mics[1].chunk();f.mics[1].ended();await settle();expect(uploads).toBe(0);expect(f.commands).toHaveLength(0);f.owner.dispose();
});
test("uncertain message writes retain the transcript and never replay automatically",async()=>{
  const f=fixture({request:async()=>({ok:false,error:"timeout"})});await f.owner.hold();f.mics[0].chunk();f.owner.release();await settle();
  expect(get(f.owner.state).sending).toBe("unconfirmed");await f.owner.hold();f.owner.sync();f.timer.advance(60000);await settle();expect(f.commands).toHaveLength(1);
  f.canonical();expect(get(f.owner.state).sending).toBe("none");f.owner.dispose();
});
test("definite prequeue refusal permits explicit retry only for the captured intent",async()=>{
  let calls=0;const f=fixture({request:async()=>++calls===1?{ok:false,error:"offline"}:{ok:true}});await f.owner.hold();f.mics[0].chunk();f.owner.release();await settle();
  const old=get(f.owner.state).intent;expect(get(f.owner.state).error).toBe("send-refused");
  await f.owner.hold();expect(f.commands).toHaveLength(1);f.owner.retry(old);await settle();expect(f.commands).toHaveLength(2);
  f.owner.retry(old);expect(f.commands).toHaveLength(2);f.canonical();expect(get(f.owner.state).sending).toBe("none");f.owner.dispose();
});
test("known global401 and room403 do not fall back to preview or send",async()=>{
  for(const error of [new FireFailure(401,true),new FireFailure(403,false,true)]){
    const f=fixture({transcribe:async()=>{throw error;}});await f.owner.hold();f.engines[0].onresult?.({results:[{0:{transcript:"do not send"}}]});f.mics[0].chunk();f.owner.release();await settle();
    expect(f.commands).toHaveLength(0);expect(f.lost+f.denied).toBe(1);f.owner.sync();expect(get(f.owner.state).text).toBe("");f.owner.dispose();
  }
});
test("empty-composer Space uses alternate hold/release while tap and nonempty hold keep dictation",()=>{
  const timer=manualClock();let text="",revision=0,held=0,released=0,started=0;
  const rec:SpeechRecognizer={lang:"",continuous:false,interimResults:false,onresult:null,onerror:null,onend:null,start(){started++;},stop(){},abort(){}};
  const speech=createSpeechController({factory:()=>rec,clock:timer.clock,locale:"en",read:()=>({text,revision,start:text.length,end:text.length}),write:value=>{text=value;revision++;},canStart:()=>true,canHold:()=>!text.trim(),heldStart:()=>{if(text.trim())return false;held++;return true;},heldRelease:()=>{released++;},recording(){},error(){},ended(){}});
  const key={key:" ",preventDefault(){}};speech.keydown(key);timer.advance(349);speech.keyup(key);expect(text).toBe(" ");expect(held).toBe(0);
  speech.keydown(key);timer.advance(350);speech.keyup(key);expect(held).toBe(1);expect(released).toBe(1);expect(started).toBe(0);
  text="existing";speech.keydown(key);timer.advance(350);speech.keyup(key);expect(started).toBe(1);speech.dispose();
});
test("microphone hold remains finite and active-Fire tap delegates recording toggle",()=>{
  const timer=manualClock();let armed=0,toggles=0,dictates=0,live=false;const charge:(number|null)[]=[];
  const mic=createMicrophoneGesture({clock:timer.clock,current:()=>true,recording:()=>false,start:()=>{dictates++;},stop(){},fireLive:()=>live,stopFire:()=>{toggles++;},armFire:()=>{armed++;live=true;},charge:value=>charge.push(value)});
  mic.begin(1);timer.advance(399);expect(charge.at(-1)).toBeNull();timer.advance(1);expect(charge.at(-1)).toBe(0);timer.advance(2600);expect(armed).toBe(1);mic.end(1);expect(dictates).toBe(0);
  mic.begin(2);mic.end(2);expect(toggles).toBe(1);mic.dispose();expect(timer.jobs.size).toBe(0);
});


test("Send/cancel intent invalidates late Whisper and media after release",async()=>{
  const response=deferred<string>();const f=fixture({transcribe:()=>response.promise});await f.owner.hold();f.mics[0].chunk();f.owner.release();await settle();
  f.owner.suspend();response.resolve("late after explicit Send");await settle();
  expect(f.commands).toHaveLength(0);expect(get(f.owner.state).sending).toBe("none");expect(get(f.owner.state).text).toBe("");f.owner.dispose();
});
