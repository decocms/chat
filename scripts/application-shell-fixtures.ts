import { get } from "svelte/store";
import { createApplicationServices } from "../web/features/application/services";
import { createApplicationCopy } from "../web/features/application/copy";
import { createDeviceLock } from "../web/features/account/device";
import { createPwaService, type PwaService } from "../web/features/pwa/service";
import type { BrowserApplicationServices } from "../web/features/application/browser";
import type {
  ApplicationShellEffects,
  ApplicationTheme,
} from "../web/features/application/shellTypes";
import type { AgentsApi } from "../web/features/agents/api";
import type { HomeApi } from "../web/features/home/api";
import type { RoomConnectionOptions } from "../web/app/roomConnection";
import type { RoomCommand } from "../shared/commands";
import { homeApi, me, manualClock } from "./home-fixtures";
export function shellFixture(
  overrides: Partial<HomeApi> = {},
  options: { pwa?: () => PwaService; href?: string } = {},
) {
  const timer = manualClock();
  let href = options.href ?? "https://vibebook.test/",
    canonical = me(),
    theme: ApplicationTheme = "auto";
  let themeListener = () => {},
    navListener: Parameters<
      ApplicationShellEffects["listenNavigation"]
    >[0] = () => {};
  const stopped: string[] = [],
    documents: string[] = [],
    names: string[] = [],
    languages: string[] = [],
    connectionCallbacks: RoomConnectionOptions[] = [],
    roomCommands: RoomCommand[] = [],
    backs: string[] = [];
  const device = createDeviceLock({
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    credentials: null,
    random: (size) => new Uint8Array(size),
    clock: timer.clock,
  });
  const agentsApi: AgentsApi = {
    identity: async () => canonical.email,
    grants: async () => ({ agents: [], last_used: null }),
    revoke: async () => ({ ok: true, removed: 0 }),
    room: async () => ({ claude_on: false, agents: [], sandboxes: [] }),
    focus: async () => ({ ok: true }),
    toggle: async (_id, on) => ({ ok: true, claude_on: on }),
    delivery: async () => ({ ok: true }),
    sandboxes: async () => ({ connected: true, claude: true, sandboxes: [] }),
    create: async () => ({
      ok: true,
      id: "fixture",
      vm_id: "vm",
      name: "fixture",
    }),
    power: async () => ({ ok: true }),
    setup: async () => ({ ok: true, log: "" }),
    remove: async () => ({ ok: true }),
    terminal: async () => ({
      url: "wss://api.freestyle.sh/v5/vms/vm/pty",
      token: "controlled-fixture",
    }),
    connected: async () => ({ connected: true }),
    saveKey: async () => ({ ok: true }),
    removeKey: async () => ({ ok: true }),
    saveToken: async () => ({ ok: true }),
    removeToken: async () => ({ ok: true }),
  };
  const core = createApplicationServices({
    browser: {
      origin: "https://vibebook.test",
      href: () => href,
      history: {
        pushState(_state, _title, url) {
          href = new URL(String(url), href).href;
        },
        replaceState(_state, _title, url) {
          href = new URL(String(url), href).href;
        },
      },
      socketUrl: (path) => `wss://vibebook.test${path}`,
      visible: () => true,
      listenVisibility: () => () => stopped.push("visibility"),
      listenPop: () => () => stopped.push("pop"),
      enqueue: queueMicrotask,
      navigateDocument: (value) => documents.push(value),
      reload: () => documents.push("reload"),
      logoutPost: async () => ({ ok: true }),
      logoutWarning: () => {},
      logoutFailure: () => {},
      shellVersion: "development",
      clock: { ...timer.clock, now: () => 1 },
    },
    homeApi: homeApi({
      me: async () => canonical,
      inbox: async () => ({ waits: canonical.waits, mentions: [], tasks: [] }),
      ...overrides,
    }),
    agentsApi,
    device,
    pwa: options.pwa ?? createPwaService,
    accountApi: {
      logins: async () => ({
        logins: [],
      }),
      name: async (name) => {
        names.push(name);
        return { ok: true, name };
      },
      avatar: async () => ({ ok: true, avatar: 1 }),
      connect: async () => ({ ok: true as const }),
      dismiss: async () => ({ ok: true as const }),
      answerInvite: async () => ({ ok: true as const }),
      orgRooms: async () => ({ domain: null, rooms: [] }),
      joinOrg: async () => ({ ok: true as const, member: true as const }),
    },
    runnerFetch: async () =>
      new Response("null", { headers: { "content-type": "application/json" } }),
    personalConnection: () => ({ start() {}, restart() {}, dispose() {} }),
    roomConnection(options) {
      connectionCallbacks.push(options);
      return {
        start() {},
        dispose() {},
        resync() {},
        send(command) {
          roomCommands.push(command);
          return true;
        },
        request: async (command) => {
          roomCommands.push(command);
          return { ok: true };
        },
      };
    },
  });
  const services: BrowserApplicationServices = {
    ...core,
    device,
    language: "en",
    locale: "en-US",
    t: createApplicationCopy("en"),
  };
  const effects: ApplicationShellEffects = {
    origin: "https://vibebook.test",
    theme: () => theme,
    setTheme(value) {
      theme = value;
      themeListener();
    },
    setLanguage: (value) => languages.push(value),
    documentLanguage: (value) => languages.push(`document:${value}`),
    listenTheme(callback) {
      themeListener = callback;
      return () => stopped.push("theme");
    },
    listenNavigation(callback) {
      navListener = callback;
      return () => stopped.push("navigation");
    },
    back: () => backs.push(href),
  };
  return {
    services,
    effects,
    timer,
    stopped,
    documents,
    names,
    languages,
    connectionCallbacks,
    roomCommands,
    backs,
    canonical(value: typeof canonical) {
      canonical = value;
    },
    href: () => href,
    theme: () => theme,
    navigate(event: MouseEvent, anchor: HTMLAnchorElement) {
      navListener(event, anchor);
    },
    identity: () => get(core.personal.state).identityRevision,
  };
}
