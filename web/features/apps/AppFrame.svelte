<script lang="ts">
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import { onMount, onDestroy, untrack } from "svelte";
  import { get } from "svelte/store";
  import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps/app-bridge";
  import type { AppsProps, AppBridgeModule } from "./types";
  import { AppsFailure } from "./api";
  import { appIdentity, roomApps, signinUrl } from "./model";
  import type { RoomAppBridge } from "./bridge";
  import { createAppConsent, type AppQuestion } from "./consent";
  import { createAppRequests } from "./requests";
  import { appDocumentAction } from "./documentAction";
  import {
    createRoomAppTools,
    roomRead,
    roomTools,
    toolOutput,
    toolError,
  } from "./tools";
  import Button from "../../lib/studio/Button.svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import { appDocumentFrameName } from "../../../shared/appDocumentProtocol";
  const frameName = appDocumentFrameName();
  let {
    props,
    inline = false,
    requireOpeningConsent = false,
  }: {
    props: AppsProps;
    inline?: boolean;
    requireOpeningConsent?: boolean;
  } = $props();
  const view = untrack(() => props.owner.state),
    requests = createAppRequests();
  let frame: HTMLIFrameElement | undefined = $state(),
    bridge: RoomAppBridge | null = null,
    protocol: AppBridgeModule | null = null,
    active = true,
    error = $state(""),
    loading = $state(true),
    declined = $state(false),
    signinNeeded = $state(false);
  const selected = untrack(() => get(props.owner.state).target),
    initialKey = untrack(() =>
      selected
        ? appIdentity(
            props.room,
            get(props.owner.state).connections || [],
            selected,
          )
        : null,
    ),
    revision = untrack(() => get(props.owner.state).frameRevision);
  const room = () => get(props.owner.state).room;
  const current = () =>
    active &&
    props.current() &&
    props.owner.current() &&
    !!frame?.isConnected &&
    get(props.owner.state).frameRevision === revision &&
    !!selected &&
    get(props.owner.state).target?.connection === selected.connection &&
    get(props.owner.state).target?.tool === selected.tool &&
    !!room() &&
    appIdentity(
      room() || props.room,
      get(props.owner.state).connections || [],
      selected,
    ) === initialKey;
  const documentCurrent = () => current() && !!bridge?.active();
  // A document marker is another person's content, not this reader's Open action.
  // This opening question deliberately precedes any private document capability.
  const openingConsent = createAppConsent(current),
    openingQuestion = openingConsent.question,
    consent = createAppConsent(documentCurrent),
    question = consent.question;
  const ask = consent.ask;
  function choose(intent: AppQuestion, answer: boolean) {
    if (!openingConsent.choose(intent, answer)) consent.choose(intent, answer);
  }
  const connected = (event: Event) =>
    current() &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected;
  function context(): McpUiHostContext {
    const rect = frame?.getBoundingClientRect(),
      dark =
        document.documentElement.dataset.theme === "dark" ||
        (document.documentElement.dataset.theme !== "light" &&
          matchMedia("(prefers-color-scheme: dark)").matches);
    return {
      theme: dark ? "dark" : "light",
      displayMode: inline ? "inline" : "fullscreen",
      availableDisplayModes: inline ? ["inline"] : ["fullscreen"],
      containerDimensions: {
        height: Math.round(rect?.height || 0),
        width: Math.round(rect?.width || 0),
      },
      locale: props.lang === "en" ? "en-US" : "pt-BR",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: matchMedia(MOBILE_QUERY).matches ? "mobile" : "web",
      user: { email: props.room.me, name: props.name(props.room.me) },
      room: { id: props.room.id, title: props.room.book.title },
    };
  }
  const callRemote = async (
    cid: string,
    name: string,
    args: unknown,
    documentRequest = true,
  ) => {
    if (!current()) throw Error("App is no longer active");
    const operation = () =>
      requests
        .run((signal) => props.api.call(cid, name, args, signal))
        .catch((error: unknown) => {
          if (error instanceof AppsFailure && error.accessDenied)
            props.owner.revoke();
          if (current() && error instanceof AppsFailure && error.signIn) {
            signinNeeded = true;
            props.owner.load();
          }
          throw error;
        });
    const result = documentRequest
      ? await appDocumentAction(current, () => bridge, operation)
      : { ok: true as const, value: await operation() };
    if (!result.ok || !current() || (documentRequest && !documentCurrent()))
      throw Error("App is no longer active");
    if (!protocol) throw Error("App bridge unavailable");
    return protocol.remoteToolResult(result.value.result);
  };
  const membershipError = (error: unknown): never => {
    if (error instanceof AppsFailure && error.accessDenied)
      props.owner.revoke();
    throw error;
  };
  const tools = createRoomAppTools({
    room: () => (documentCurrent() ? room() : null),
    current: documentCurrent,
    request: async (command) => {
      const result = await appDocumentAction(
        current,
        () => bridge,
        () => props.request(command),
      );
      return result.ok ? result.value : { ok: false, error: "disconnected" };
    },
    name: (email) => props.name(email),
    ask,
    connections: async () => {
      const result = await requests
        .run((signal) => props.api.list(signal))
        .catch(membershipError);
      return current() ? result.connections : [];
    },
    call: callRemote,
    metric: (kind, roomOnly, days) =>
      props.metric(kind, roomOnly, days).catch((error: unknown) => {
        if (error instanceof AppsFailure && error.sessionDenied)
          props.owner.revoke();
        throw error;
      }),
    t: (text, vars) => props.t(text, vars),
  });
  async function start() {
    if (!frame || !selected || !initialKey) return;
    const isRoom = selected.connection === "room";
    try {
      if ((inline || requireOpeningConsent) && !isRoom) {
        const connection = get(props.owner.state).connections?.find(
          (item) => item.id === selected.connection,
        );
        const allowed = await openingConsent.ask(
          props.t("usar {tool} em {conn}", {
            tool: selected.tool,
            conn: connection?.title || selected.connection,
          }),
          props.t("Abrir este app pode executar ferramentas na sua conta."),
        );
        if (!current()) return;
        if (!allowed) {
          declined = true;
          loading = false;
          return;
        }
      }
      const loaded = await requests.run(
        props.loadBridge ?? (() => import("./bridge")),
      );
      if (!current()) return;
      protocol = loaded;
      const app = isRoom
        ? roomApps(props.room).find((app) => app.tool === selected.tool)
        : null;
      const ui = isRoom
        ? null
        : await requests.run((signal) =>
            props.api.ui(selected.connection, selected.tool, signal),
          );
      if (!current()) return;
      const tool = protocol.appToolInfo(ui?.tool, {
        name: selected.tool,
        title: app?.title || selected.tool,
        inputSchema: { type: "object" },
      });
      const first = isRoom
        ? Promise.resolve(
            toolOutput(roomRead(room() || props.room, {}, props.name)),
          )
        : callRemote(selected.connection, selected.tool, {}, false).catch(
            (error) =>
              toolError(error instanceof Error ? error.message : "Tool failed"),
          );
      bridge = protocol.createRoomAppBridge({
        frame,
        current,
        revoked: () => {
          if (!current()) return;
          requests.dispose();
          openingConsent.cancel();
          consent.cancel();
          loading = false;
          error =
            props.lang === "en"
              ? "This app was closed. Reopen it to continue."
              : "O app foi fechado. Abra de novo para continuar.";
        },
        context: () => ({ ...context(), toolInfo: { tool } }),
        tools: isRoom ? roomTools : [],
        call: isRoom
          ? tools
          : (name, args) => callRemote(selected.connection, name, args),
        message: (text) =>
          tools("vibebook_post", { text, thread: props.thread }),
        compose: props.compose
          ? (text) => {
              if (current()) props.compose?.(text);
            }
          : undefined,
        ask,
        open: (url) => {
          if (current()) props.openLink(url);
        },
        first,
        contextText: isRoom
          ? undefined
          : async (text) => {
              await appDocumentAction(
                current,
                () => bridge,
                () =>
                  requests
                    .run((signal) =>
                      props.api.context(
                        selected.connection,
                        selected.tool,
                        text,
                        signal,
                      ),
                    )
                    .catch(membershipError),
              );
            },
        t: (text, vars) => props.t(text, vars),
      });
      await bridge.ready;
      if (!current()) return;
      if (isRoom && app)
        bridge.loadFile(
          `/api/books/${encodeURIComponent(props.room.id)}/files/${encodeURIComponent(app.file.id)}`,
        );
      else if (ui) bridge.loadHtml(ui.html);
      loading = false;
    } catch (failure) {
      if (failure instanceof AppsFailure && failure.accessDenied)
        props.owner.revoke();
      if (current()) {
        if (failure instanceof AppsFailure && failure.signIn)
          signinNeeded = true;
        loading = false;
        error =
          failure instanceof Error ? failure.message : "App failed to load";
      }
    }
  }
  onMount(() => {
    void start();
    const observer = new ResizeObserver(() => bridge?.update());
    if (frame) observer.observe(frame);
    return () => observer.disconnect();
  });
  $effect(() => {
    props.room;
    props.lang;
    bridge?.update();
  });
  onDestroy(() => {
    active = false;
    requests.dispose();
    bridge?.dispose();
    openingConsent.dispose();
    consent.dispose();
  });
</script>

<div data-app-frame class="flex min-h-0 flex-1 flex-col gap-2">
  {#if loading}<p role="status" class="p-3 text-sm text-muted-foreground">
      {props.t("Carregando…")}
    </p>{/if}
  {#if error}<div role="alert" class="space-y-2 p-3 text-sm text-destructive">
      <p>{error}</p>
      <Button
        variant="outline"
        onclick={(event) => {
          if (connected(event)) props.owner.reload();
        }}>{props.t("Tentar de novo")}</Button
      >
    </div>{/if}
  {#if declined}<div role="status" class="space-y-2 p-3">
      <p>{props.t("App não aberto.")}</p>
      <Button
        variant="outline"
        onclick={(event) => {
          if (connected(event)) props.owner.reload();
        }}>{props.t("Reabrir")}</Button
      >
    </div>{/if}
  {#if $openingQuestion || $question}{#key $openingQuestion || $question}<Snapshot
        value={($openingQuestion || $question)!}
      >
        {#snippet children(intent)}
          <section
            aria-label={props.t("Permissão do app")}
            class="space-y-2 rounded-control border border-border bg-card p-3"
            aria-live="polite"
          >
            <p class="text-sm">
              {props.t("Este app quer {what}, como você:", {
                what: intent.what,
              })}
            </p>
            <blockquote
              class="m-0 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-xs"
            >
              {intent.detail}
            </blockquote>
            <div class="flex gap-2">
              <Button
                variant="outline"
                onclick={(event) => {
                  if (connected(event)) choose(intent, false);
                }}>{props.t("Cancelar")}</Button
              ><Button
                onclick={(event) => {
                  if (connected(event)) choose(intent, true);
                }}>{props.t("Permitir")}</Button
              >
            </div>
          </section>{/snippet}</Snapshot
      >{/key}{/if}
  {#if signinNeeded && selected && selected.connection !== "room"}<p
      role="alert"
      class="text-sm"
    >
      <a
        href={signinUrl(props.room.id, selected.connection)}
        onclick={(event) => {
          if (!connected(event)) event.preventDefault();
        }}
        class="text-foreground underline decoration-current/35 underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-ring"
        >{props.t("Entrar")}</a
      >
    </p>{/if}
  <iframe
    bind:this={frame}
    name={frameName}
    sandbox="allow-scripts allow-forms"
    title={selected?.tool || "App"}
    class={inline
      ? "min-h-0 w-full flex-1 border-0 bg-background"
      : "min-h-80 w-full flex-1 border-0 bg-background"}
    hidden={!!error || declined || !!$openingQuestion}
  ></iframe>
</div>
