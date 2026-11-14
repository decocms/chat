import { expect, test } from "bun:test";
import { get } from "svelte/store";
import { roomScopeFixture } from "./room-scope-fixtures";
import { settle } from "./native-home-fixtures";

test("reply waits for pending sheet navigation and then uses the intended thread draft", async () => {
  const h = await roomScopeFixture(),
    view = get(h.owner.state)!;
  h.hold();
  view.chat!.actions.reply(1);
  expect(h.app.services.rootRoom.read().thread).toBe("main");
  expect(
    get(
      h.resources.composer.entry({
        account: h.room.me,
        roomId: h.room.id,
        thread: "main",
      }).state,
    ).replyId,
  ).toBeUndefined();
  h.release();
  expect(h.app.services.rootRoom.read().thread).toBe("other");
  expect(
    get(
      h.resources.composer.entry({
        account: h.room.me,
        roomId: h.room.id,
        thread: "other",
      }).state,
    ).replyId,
  ).toBe(1);
  expect(
    get(
      h.resources.composer.entry({
        account: h.room.me,
        roomId: h.room.id,
        thread: "main",
      }).state,
    ).replyId,
  ).toBeUndefined();
  h.dispose();
});

test("deferred pane and reply intents cannot cross room departure", async () => {
  const h = await roomScopeFixture();
  h.hold();
  h.owner.actions.setPane("files");
  expect(get(h.app.services.state).pane).toBe("doc");
  h.owner.dispose();
  h.app.services.actions.home();
  h.release();
  expect(h.app.services.rootRoom.read().room).toBeNull();
  expect(get(h.owner.state)).toBeNull();
  h.dispose();
});

test("passive canonical frames do not start Apps catalog HTTP reads", async () => {
  const h = await roomScopeFixture();
  h.publish();
  h.publish();
  await settle();
  expect(h.requests).toEqual([]);
  h.dispose();
});

test("old room attachment cleanup cannot detach the replacement even when the actor is reused", async () => {
  const h = await roomScopeFixture(),
    service = h.app.services.agents,
    actor = h.app.services.syncAgents()!;
  const releaseOld = service.claimAttachment(),
    releaseNew = service.claimAttachment();
  releaseOld();
  expect(get(actor.state).room?.id).toBe(h.room.id);
  expect(actor.current()).toBe(true);
  releaseNew();
  expect(get(actor.state).room).toBeNull();
  h.dispose();
});

test("notice deadline is scoped and an uncancelled old deadline cannot clear its replacement", async () => {
  const h = await roomScopeFixture();
  h.ignoreTimerCancellation();
  h.serverEvent({ t: "error", error: "First issue" });
  expect(get(h.owner.state)?.notice).toBe("First issue");
  h.app.timer.advance(1000);
  h.serverEvent({ t: "error", error: "Later issue" });
  h.app.timer.advance(6000);
  expect(get(h.owner.state)?.notice).toBe("Later issue");
  h.app.timer.advance(1000);
  expect(get(h.owner.state)?.notice).toBe("");
  h.dispose();
});

test("partial room metadata retains the signed-in user's own canonical mention name", async () => {
  const h = await roomScopeFixture();
  expect(h.room.names).toBeUndefined();
  expect(get(h.owner.state)?.chat?.vb.knownNames?.[h.room.me]).toBe("Me");
  h.dispose();
});

test("document resize pixels do not rebuild Chat or feature props", async () => {
  const h = await roomScopeFixture(),
    before = get(h.owner.state);
  h.resizeDocument(400);
  h.resizeDocument(410);
  h.resizeDocument(420);
  expect(get(h.owner.state)).toBe(before);
  h.dispose();
});

test("CID-only OAuth return opens a fresh Apps catalog without selecting or invoking any tool", async () => {
  const h = await roomScopeFixture("/b/aaaaaa?ui=svelte#app:abcdef123456");
  await settle();
  expect(get(h.app.services.state).pane).toBe("apps");
  expect(get(h.owner.state)?.toolbar.pane).toBe("apps");
  const apps = get(h.owner.state)!.apps.owner;
  expect(get(apps.state).target).toBeNull();
  expect(h.requests.filter((url) => url.includes("/connections"))).toHaveLength(
    1,
  );
  expect(h.requests.every((url) => url.endsWith("/connections"))).toBe(true);
  h.dispose();
});

test("tool app route remains exact, while deferred catalog return cannot mutate a departed scope", async () => {
  const h = await roomScopeFixture("/b/aaaaaa?ui=svelte#app:room/report-v2");
  await settle();
  expect(get(get(h.owner.state)!.apps.owner.state).target).toEqual({
    connection: "room",
    tool: "report-v2",
  });
  h.hold();
  h.app.services.actions.navigate("/b/aaaaaa?ui=svelte#app:abcdef123456");
  h.owner.dispose();
  h.app.services.actions.home();
  h.release();
  expect(get(h.owner.state)).toBeNull();
  expect(h.app.services.rootRoom.read().room).toBeNull();
  h.dispose();
});

test("legacy document hashes select the real epic and never open a deleted epic as the main document", async () => {
  const h = await roomScopeFixture("/b/aaaaaa?ui=svelte#doc:other");
  expect(h.app.services.rootRoom.read().thread).toBe("other");
  expect(get(get(h.owner.state)!.document.owner.state).target?.epicId).toBe(
    "other",
  );
  expect(new URL(h.app.href()).searchParams.get("t")).toBe("other");
  h.owner.actions.setPane("files");
  h.app.services.actions.navigate("/b/aaaaaa?ui=svelte#doc:deleted");
  expect(h.app.services.rootRoom.read().thread).toBe("main");
  expect(get(h.app.services.state).pane).toBe("files");
  expect(get(h.owner.state)?.notice).toBeTruthy();
  expect(
    h.app.roomCommands.some(
      (command) => command.t === "doc.get" && command.epic === "deleted",
    ),
  ).toBe(false);
  h.dispose();
});

test("Put in doc uses the actual scoped DocumentSession and old thread callbacks cannot write another document", async () => {
  const h = await roomScopeFixture();
  h.room.doc = "Room introduction";
  h.publish();
  const rendered = get(h.owner.state)!;
  rendered.apps.putInDocument?.({ connection: "room", tool: "demo" });
  const view = get(rendered.document.owner.state);
  expect(view.text).toBe("Room introduction\n\n[[app:room/demo|m]]\n");
  expect(view.fallbackPending).toBe(true);
  expect(view.target?.epicId).toBeNull();
  h.owner.actions.setThread("other");
  const next = get(h.owner.state)!;
  const before = get(next.document.owner.state).text;
  rendered.apps.putInDocument?.({ connection: "room", tool: "stale" });
  expect(get(next.document.owner.state).text).toBe(before);
  h.dispose();
});

test('actual composer submit carries the currently viewed canonical version, including historical selection',async()=>{
 for(const historical of [false,true]) {
  const h=await roomScopeFixture();
  try {
   const old={id:'aa',name:'page.html',type:'text/html',size:4,ts:1,author:h.room.me};
   const latest={...old,id:'bb',ts:2};
   h.room.files=[old];h.publish();h.owner.actions.openSideFile(old);
   const rendered=get(h.owner.state)!.composer!;
   h.room.files=[latest,old];h.publish();
   if(historical){const side=get(h.owner.state)!.sideFile.owner;side.select(side.target()!,'aa');}
   // The earlier rendered request port reads the current target, not its old projection.
   await rendered.request({t:'msg',thread:'main',text:'this page'});
   const sent=h.app.roomCommands.filter(command=>command.t==='msg').at(-1)!;
   expect(sent.t==='msg' && sent.viewing).toBe(historical?'aa':'bb');
   const entry=h.resources.composer.entry({account:h.room.me,roomId:h.room.id,thread:'main'});
   entry.edit('actual submit with viewing');await entry.submit();
   const submitted=h.app.roomCommands.filter(command=>command.t==='msg').at(-1)!;
   expect(submitted.t==='msg'&&submitted.viewing).toBe(historical?'aa':'bb');
  }finally{h.dispose();}
 }
});
test('closing the side file clears viewing and stale or mismatched composer thread ports cannot dispatch',async()=>{
 const h=await roomScopeFixture();
 try {
  const file={id:'aa',name:'page.html',type:'text/html',size:4,ts:1,author:h.room.me};
  h.room.files=[file];h.publish();h.owner.actions.openSideFile(file);
  const rendered=get(h.owner.state)!.composer!;
  get(h.owner.state)!.sideFile.close();
  await rendered.request({t:'msg',thread:'main',text:'closed context',viewing:'stale'});
  const sent=h.app.roomCommands.filter(command=>command.t==='msg').at(-1)!;
  expect(sent.t==='msg'&&sent.viewing).toBeUndefined();
  const before=h.app.roomCommands.filter(command=>command.t==='msg').length;
  expect((await rendered.request({t:'msg',thread:'other',text:'wrong thread'})).ok).toBe(false);
  h.owner.actions.setThread('other');
  expect((await rendered.request({t:'msg',thread:'main',text:'stale main'})).ok).toBe(false);
  h.owner.dispose();
  expect((await rendered.request({t:'msg',thread:'main',text:'departed'})).ok).toBe(false);
  expect(h.app.roomCommands.filter(command=>command.t==='msg')).toHaveLength(before);
 }finally{h.dispose();}
});
