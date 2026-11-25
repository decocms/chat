<script lang="ts">
  import { onDestroy } from "svelte";
  import { writable } from "svelte/store";
  import CallStage from "../../features/call/CallStage.svelte";
  import CallControls from "../../features/call/CallControls.svelte";
  import CallSidebarRow from "../../features/call/CallSidebarRow.svelte";
  import type { CallSession, CallView } from "../../features/call/session";
  import type { CallPeer, Room } from "../../../shared/room";
  import { recorderEmail } from "../../../shared/call";
  // The call's stage with no SFU: a fake session whose state comes from the URL, for screenshots and design
  // review (`dev/gallery.html?probe=call&n=4&speaking=1&muted=2&share=1&cam=1&recording=1&chat=1`).
  const params = new URL(location.href).searchParams;
  const number = (key: string, fallback = 0) =>
    Number(params.get(key) ?? fallback) || fallback;
  const NAMES = [
    "Valls",
    "Ana Lima",
    "Bruno",
    "Carla",
    "Diego",
    "Elisa",
    "Fábio",
    "Gabi",
    "Hugo",
  ];
  const emails = NAMES.slice(0, Math.min(number("n", 2), NAMES.length)).map(
    (name) => `${name.split(" ")[0]?.toLowerCase()}@example.com`,
  );
  const me = emails[0] ?? "valls@example.com";
  /** A moving picture for a fake camera or screen. */
  function picture(label: string, width: number, height: number, hue: number) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    let frame = 0;
    const draw = () => {
      if (!ctx) return;
      ctx.fillStyle = `hsl(${hue} 30% 92%)`;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = `hsl(${hue} 40% 40%)`;
      ctx.fillRect(0, 0, width, height * 0.08);
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = `hsl(${hue} 20% ${70 - i * 3}%)`;
        ctx.fillRect(
          width * 0.06,
          height * (0.16 + i * 0.09),
          width * (0.3 + ((i * 37) % 50) / 100),
          height * 0.04,
        );
      }
      ctx.fillStyle = "#222";
      ctx.font = `${Math.round(height * 0.06)}px sans-serif`;
      ctx.fillText(`${label} ${frame++ % 10}`, width * 0.06, height * 0.95);
    };
    draw();
    const timer = setInterval(draw, 500);
    timers.push(timer);
    return canvas.captureStream(4);
  }
  const timers: ReturnType<typeof setInterval>[] = [];
  onDestroy(() => timers.forEach(clearInterval));
  const share = params.get("share") === "1";
  const cam = number("cam");
  const muted = number("muted");
  const peers: CallPeer[] = emails.map((email, index) => ({
    email,
    session: `s${index}`,
    tracks: [
      "mic",
      ...(share && index === 1 ? ["screen"] : []),
      ...(index > 0 && index <= cam ? ["cam"] : []),
    ],
    // `muted=k`: the last k people have their microphone off (me among them when k reaches me).
    muted: index >= emails.length - muted,
  }));
  const room = {
    me,
    names: Object.fromEntries(
      emails.map((email, index) => [email, NAMES[index] ?? email]),
    ),
    call: [
      ...peers,
      ...(params.get("recording") === "1"
        ? [{ email: recorderEmail("fixture"), session: "rec", tracks: [] }]
        : []),
    ],
    callRecorded: true,
    handles: {},
    book: { title: "vibebook-product" },
  } as unknown as Room;
  const store = writable<CallView>({
    phase: params.get("phase") === "idle" ? "idle" : "in",
    muted: peers[0]?.muted ?? false,
    sharing: false,
    screens:
      share && emails[1]
        ? { [emails[1]]: picture("screen", 1600, 900, 220) }
        : {},
    cams: Object.fromEntries(
      peers
        .filter((peer) => peer.tracks.includes("cam"))
        .map((peer, index) => [
          peer.email,
          picture(peer.email.split("@")[0] ?? "", 640, 360, 30 + index * 70),
        ]),
    ),
    camera: false,
    ownCam: null,
    watching: "",
    // `speaking=i`: the i-th person (1 = me) is speaking.
    speaking: emails.filter((_, index) => index + 1 === number("speaking")),
    own: null,
    error: "",
    limit: false,
    notice: "",
  });
  const patch = (next: Partial<CallView>) =>
    store.update((view) => ({ ...view, ...next }));
  const call: CallSession = {
    state: { subscribe: store.subscribe },
    setPeers() {},
    join: () => patch({ phase: "in" }),
    leave: () => patch({ phase: "idle" }),
    toggleMute: () => store.update((view) => ({ ...view, muted: !view.muted })),
    share: () => patch({ notice: "alone" }),
    stopShare: () => patch({ sharing: false }),
    startCamera: (stream) => patch({ camera: true, ownCam: stream }),
    stopCamera: () => patch({ camera: false, ownCam: null }),
    watch: (email) => patch({ watching: email }),
    dismissLimit: () => patch({ limit: false }),
  };
  let chatHidden = $state(params.get("chat") !== "1");
  const name = (email: string) =>
    (room.names?.[email] ?? email).split(" ")[0] ?? email;
  const phone = params.get("phone") === "1";
</script>

<div
  data-call-fixture
  class="flex h-screen w-screen gap-3 bg-background p-3 font-sans text-foreground"
>
  {#if !phone}<aside
      class="flex w-64 shrink-0 flex-col gap-3 rounded-xl bg-sidebar p-2"
    >
      <div data-fixture-row>
        <CallSidebarRow
          {call}
          peers={room.call}
          avatar={() => null}
          {name}
          t={(text, vars) =>
            text.replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? ""))}
        />
      </div>
      <div data-fixture-rail class="flex w-12 flex-col items-center gap-2">
        <CallSidebarRow
          {call}
          peers={room.call}
          collapsed
          avatar={() => null}
          {name}
          t={(text, vars) =>
            text.replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? ""))}
        />
      </div>
      <div data-fixture-top class="flex items-center gap-2">
        <CallControls
          {call}
          peers={room.call}
          {name}
          t={(text, vars) =>
            text.replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? ""))}
        /><CallControls {call} peers={[]} {name} t={(text) => text} />
      </div>
    </aside>{/if}
  <div class="flex min-w-0 flex-1 flex-col">
    <CallStage
      {room}
      {call}
      send={() => true}
      open={() => {}}
      avatar={() => null}
      fill={!phone}
      chatHidden={phone ? undefined : chatHidden}
      onchat={() => (chatHidden = !chatHidden)}
      onfull={phone ? undefined : () => {}}
      t={(text, vars) =>
        text.replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? ""))}
    />
    {#if phone}<div class="flex-1 p-4 text-sm text-muted-foreground">
        Chat…
      </div>{/if}
  </div>
</div>
