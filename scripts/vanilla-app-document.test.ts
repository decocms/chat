import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { Window, type HTMLElement, type HTMLButtonElement } from "happy-dom";

async function consentFixture() {
  const html = await readFile(
    new URL("../public/app.html", import.meta.url),
    "utf8",
  );
  const start = html.indexOf("const appAskItems = [];");
  const end = html.indexOf("// vibebook's tools", start);
  if (start < 0 || end < start)
    throw Error("Actual vanilla consent function not found");
  const ask: (
    box: HTMLElement,
    what: string,
    detail: string,
    signal?: AbortSignal,
  ) => Promise<boolean> = new Function(
    "t",
    "esc",
    `${html.slice(start, end)};return appAsk;`,
  )(
    (text: string) => text,
    (text: string) => text,
  );
  const window = new Window();
  const firstBox = window.document.createElement("div"),
    secondBox = window.document.createElement("div");
  window.document.body.append(firstBox, secondBox);
  return { ask, firstBox, secondBox, close: () => window.happyDOM.abort() };
}

test("retired consent resolves false and releases the next real vanilla question", async () => {
  const { ask, firstBox, secondBox, close } = await consentFixture();
  try {
    const controller = new AbortController();
    const first = ask(firstBox, "old", "old detail", controller.signal);
    const second = ask(secondBox, "new", "new detail");
    await Promise.resolve();
    const oldButton = firstBox.querySelector("button")!;
    controller.abort();
    expect(await first).toBe(false);
    await Promise.resolve();
    expect(firstBox.hidden).toBe(true);
    expect(secondBox.querySelector("q")?.textContent).toBe("new detail");
    oldButton.click();
    expect(secondBox.hidden).toBe(false);
    secondBox.querySelector("button")!.click();
    expect(await second).toBe(true);
  } finally {
    await close();
  }
});

test("already-aborted queued questions never display and abort only clears owned controls", async () => {
  const { ask, firstBox, secondBox, close } = await consentFixture();
  try {
    const active = new AbortController(),
      queued = new AbortController();
    const first = ask(firstBox, "active", "detail", active.signal);
    const second = ask(
      secondBox,
      "cancelled",
      "must not render",
      queued.signal,
    );
    await Promise.resolve();
    firstBox.innerHTML = '<span data-new-owner="true">newer UI</span>';
    queued.abort();
    active.abort();
    expect(await first).toBe(false);
    expect(await second).toBe(false);
    expect(firstBox.querySelector("[data-new-owner]")?.textContent).toBe(
      "newer UI",
    );
    expect(secondBox.innerHTML).toBe("");
  } finally {
    await close();
  }
});

test("late document connection reads cannot replace another room or account's app cache", async () => {
  const html = await readFile(
    new URL("../public/app.html", import.meta.url),
    "utf8",
  );
  const start = html.indexOf("async function docConns()"),
    end = html.indexOf("function docApps(", start);
  if (start < 0 || end < start)
    throw Error("Actual document connection reader missing");
  for (const changed of ["room", "account", "socket"] as const) {
    let finish!: (value: unknown) => void;
    const result = new Promise<unknown>((yes) => {
      finish = yes;
    });
    const source = new Function(
      "api",
      `let S = {id: "A", me: "personA"}, ws = {}, conns = null, connsBook = null; ${html.slice(start, end)}; return { read: docConns, switch() {${changed === "room" ? 'S = {id: "B", me: "personA"};' : changed === "account" ? 'S = {id: "A", me: "personB"};' : "ws = {};"} conns = [{id: "new-owner"}]; connsBook = S.id;}, cached() {return conns;} };`,
    );
    const owner: {
      read(): Promise<unknown>;
      switch(): void;
      cached(): unknown;
    } = source(() => result);
    const pending = owner.read();
    owner.switch();
    finish({ connections: [{ id: "old-owner" }] });
    expect(await pending).toEqual([]);
    expect(owner.cached()).toEqual([{ id: "new-owner" }]);
  }
});

async function inlineOpenFixture() {
  const html = await readFile(
    new URL("../public/app.html", import.meta.url),
    "utf8",
  );
  const consentStart = html.indexOf("const appAskItems = [];"),
    consentEnd = html.indexOf("// vibebook's tools", consentStart);
  const scopeStart = html.indexOf("function appDocumentScope("),
    scopeEnd = html.indexOf("// Removal is synchronous", scopeStart);
  const mountStart = html.indexOf("function inlineAppOpen("),
    mountEnd = html.indexOf("// Reminders:", mountStart);
  if (
    [consentStart, consentEnd, scopeStart, scopeEnd, mountStart, mountEnd].some(
      (value) => value < 0,
    )
  )
    throw Error("Actual inline Open functions missing");
  const window = new Window(),
    calls: string[] = [],
    hosts: string[] = [],
    loads: string[] = [];
  let paused: "SDK" | "ui" | undefined, waiting: Promise<void> | undefined;
  const pause = (stage: "SDK" | "ui") => {
    paused = stage;
    let release!: () => void;
    waiting = new Promise<void>((done) => {
      release = done;
    });
    return release;
  };
  const build = new Function(
    "document",
    "AbortController",
    "api",
    "loadAppDocumentHost",
    "makeHost",
    `
    const t=(text)=>text,esc=(text)=>String(text),toolOut=(value)=>({content:[{type:'text',text:String(value)}]});
    let S={id:'room',me:'reader'},thread='main',ws={readyState:1},nonce=0;
    const hosts=new WeakMap(),appDocuments=new Set(),appFrameName=()=> 'new-frame-'+(++nonce);
    ${html.slice(consentStart, consentEnd)}
    ${html.slice(scopeStart, scopeEnd)}
    ${html.slice(mountStart, mountEnd)}
    return {mount:mountApp,prune:pruneAppDocuments,pending:()=>appDocuments.size,switchAccount(){S={...S,me:'other'};},switchRoom(){S={...S,id:'other'};}};
  `,
  );
  const owner: {
    mount(
      frame: HTMLElement,
      c: object,
      a: object,
      ask?: () => HTMLElement,
    ): Promise<void>;
    prune(): void;
    pending(): number;
    switchAccount(): void;
    switchRoom(): void;
  } = build(
    window.document,
    AbortController,
    async (path: string) => {
      calls.push(path);
      if (path.includes("/ui?") && paused === "ui") await waiting;
      return path.includes("/ui?")
        ? {
            html: "<p>controlled</p>",
            tool: { name: "mutate", annotations: { readOnlyHint: false } },
          }
        : { result: { content: [] } };
    },
    async () => {
      loads.push("SDK");
      if (paused === "SDK") await waiting;
      return { createAppDocumentHost() {} };
    },
    (_frame: unknown, options: { first: Promise<unknown> }) => {
      hosts.push("host");
      void options.first.catch(() => {});
      return { start() {}, loadHtml() {}, loadFile() {} };
    },
  );
  const surfaces = Array.from({ length: 2 }, () => {
    const box = window.document.createElement("div"),
      frame = window.document.createElement("iframe"),
      ask = window.document.createElement("div");
    box.append(frame, ask);
    window.document.body.append(box);
    return { box, frame, ask };
  });
  const connection = { id: "abcdef123456", title: "Controlled connection" },
    app = { tool: "mutate", title: "Mutate" };
  const settle = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  return {
    owner,
    surfaces,
    connection,
    app,
    calls,
    hosts,
    loads,
    settle,
    pause,
    close: () => window.happyDOM.abort(),
  };
}
test("actual vanilla inline mount requires reader Allow before UI, initial mutating call or private host; Cancel and retry are explicit", async () => {
  const f = await inlineOpenFixture();
  try {
    const first = f.surfaces[0]!,
      second = f.surfaces[1]!;
    const a = f.owner.mount(first.frame, f.connection, f.app, () => first.ask),
      b = f.owner.mount(second.frame, f.connection, f.app, () => second.ask);
    await f.settle();
    expect(f.owner.pending()).toBe(2);
    expect(f.calls).toEqual([]);
    expect(f.hosts).toEqual([]);
    expect(f.loads).toEqual([]);
    first.ask.querySelector<HTMLButtonElement>(".ghost")!.click();
    await a;
    await f.settle();
    expect(first.box.textContent).toContain("App não aberto.");
    expect(f.calls).toEqual([]);
    second.ask.querySelector<HTMLButtonElement>(".primary")!.click();
    await b;
    expect(f.calls.filter((path) => path.includes("/call"))).toHaveLength(1);
    expect(f.hosts).toHaveLength(1);
    first.box.querySelector<HTMLButtonElement>("button")!.click();
    await f.settle();
    expect(f.calls.filter((path) => path.includes("/call"))).toHaveLength(1);
    first.ask.querySelector<HTMLButtonElement>(".primary")!.click();
    await f.settle();
    expect(f.calls.filter((path) => path.includes("/call"))).toHaveLength(2);
    expect(f.hosts).toHaveLength(2);
    expect(f.owner.pending()).toBe(0);
  } finally {
    await f.close();
  }
});
test("actual vanilla pending inline consent is aborted on removal/account/room changes and stale Allow cannot dispatch", async () => {
  for (const changed of ["remove", "account", "room"] as const) {
    const f = await inlineOpenFixture();
    try {
      const surface = f.surfaces[0]!,
        operation = f.owner.mount(
          surface.frame,
          f.connection,
          f.app,
          () => surface.ask,
        );
      await f.settle();
      const old = surface.ask.querySelector<HTMLButtonElement>(".primary")!;
      if (changed === "remove") surface.frame.remove();
      else if (changed === "account") f.owner.switchAccount();
      else f.owner.switchRoom();
      f.owner.prune();
      await operation;
      old.click();
      await f.settle();
      expect(f.owner.pending()).toBe(0);
      expect(f.calls).toEqual([]);
      expect(f.hosts).toEqual([]);
      expect(f.loads).toEqual([]);
    } finally {
      await f.close();
    }
  }
});
test("actual vanilla explicit panel Open preserves its existing initial call without an inline question", async () => {
  const f = await inlineOpenFixture();
  try {
    await f.owner.mount(f.surfaces[0]!.frame, f.connection, f.app);
    expect(f.calls.filter((path) => path.includes("/call"))).toHaveLength(1);
    expect(f.hosts).toHaveLength(1);
    expect(f.owner.pending()).toBe(0);
  } finally {
    await f.close();
  }
});

test("accepted vanilla inline opening cannot resume a disposed grant after delayed SDK/UI and frame reinsertion", async () => {
  for (const stage of ["SDK", "ui"] as const) {
    const f = await inlineOpenFixture();
    try {
      const surface = f.surfaces[0]!,
        release = f.pause(stage);
      const operation = f.owner.mount(
        surface.frame,
        f.connection,
        f.app,
        () => surface.ask,
      );
      await f.settle();
      surface.ask.querySelector<HTMLButtonElement>(".primary")!.click();
      await f.settle();
      expect(f.loads).toEqual(["SDK"]);
      surface.frame.remove();
      f.owner.prune();
      surface.box.prepend(surface.frame);
      release();
      await operation;
      expect(f.calls.filter((path) => path.includes("/call"))).toEqual([]);
      expect(f.hosts).toEqual([]);
      expect(f.owner.pending()).toBe(0);
    } finally {
      await f.close();
    }
  }
});

test("queued vanilla B abort settles immediately and unlinks it while A and C keep their own questions", async () => {
  const { ask, firstBox, secondBox, close } = await consentFixture();
  const firstAbort = new AbortController(),
    secondAbort = new AbortController();
  try {
    const first = ask(firstBox, "A", "A detail", firstAbort.signal);
    const second = ask(secondBox, "B", "B detail", secondAbort.signal);
    const third = ask(secondBox, "C", "C detail");
    await Promise.resolve();
    const allowA = firstBox.querySelector("button")!;
    let secondSettled = false;
    void second.then(() => {
      secondSettled = true;
    });
    secondAbort.abort();
    await Promise.resolve();
    await Promise.resolve();
    expect(secondSettled).toBe(true);
    expect(await second).toBe(false);
    expect(firstBox.querySelector("button")).toBe(allowA);
    expect(firstBox.querySelector("q")?.textContent).toBe("A detail");
    expect(secondBox.textContent).not.toContain("B detail");
    allowA.click();
    expect(await first).toBe(true);
    await Promise.resolve();
    expect(secondBox.querySelector("q")?.textContent).toBe("C detail");
    secondBox.querySelector("button")!.click();
    expect(await third).toBe(true);
  } finally {
    firstAbort.abort();
    secondAbort.abort();
    await close();
  }
});

test("pruning queued vanilla inline B releases its mount before unanswered A without SDK or calls", async () => {
  const f = await inlineOpenFixture();
  try {
    const first = f.surfaces[0]!,
      second = f.surfaces[1]!;
    const a = f.owner.mount(first.frame, f.connection, f.app, () => first.ask);
    const b = f.owner.mount(
      second.frame,
      f.connection,
      f.app,
      () => second.ask,
    );
    await f.settle();
    const allowA = first.ask.querySelector("button")!;
    let settled = false;
    void b.then(() => {
      settled = true;
    });
    second.frame.remove();
    f.owner.prune();
    await f.settle();
    expect(settled).toBe(true);
    expect(first.ask.querySelector("button")).toBe(allowA);
    expect(f.calls).toEqual([]);
    expect(f.loads).toEqual([]);
    expect(f.hosts).toEqual([]);
    first.ask.querySelector<HTMLButtonElement>(".ghost")!.click();
    await a;
    await b;
  } finally {
    await f.close();
  }
});

test("agent-opened remote panel waits for this reader's Open and stale controls cannot grant it", async () => {
  const html = await readFile(new URL("../public/app.html", import.meta.url), "utf8");
  const start = html.indexOf("function renderConnApp(el) {"), end = html.indexOf("const textOf =", start);
  if (start < 0 || end < start) throw Error("Actual panel function missing");
  const window = new Window(), el = window.document.createElement("div");
  window.document.body.append(el);
  const scope = {id:"room",me:"reader@example.test"}, target = {cid:"remote",tool:"mutate",requireOpeningConsent:true};
  let renders=0;
  const actual: {render():void; selected():unknown;replace(value:unknown):void} = new Function("el","S","conns","target","t","esc","renderConns", `let connApp=target;${html.slice(start,end)};return {render:()=>renderConnApp(el),selected:()=>connApp,replace:value=>{connApp=value}};`)(el,scope,[{id:"remote",apps:[{tool:"mutate",title:"Mutation"}]}],target,(text:string)=>text,(text:string)=>text,()=>{renders++;});
  try {
    actual.render();expect(el.querySelector("iframe")).toBeNull();
    const open=el.querySelector<HTMLButtonElement>("#connReaderOpen")!;
    scope.me="other@example.test";open.click();expect(renders).toBe(0);
    scope.me="reader@example.test";scope.id="other";open.click();expect(renders).toBe(0);
    scope.id="room";actual.replace({...target});open.click();expect(renders).toBe(0);
    actual.replace(target);open.click();expect(renders).toBe(1);
    expect(actual.selected()).toEqual({cid:"remote",tool:"mutate"});
    open.click();expect(renders).toBe(1);
  } finally {await window.happyDOM.abort();}
});
