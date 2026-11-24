<script lang="ts">
  import { untrack } from "svelte";
  import { readable } from "svelte/store";
  import type { ConnectionMode } from "./directTypes";
  import Badge from "../../lib/studio/Badge.svelte";
  import type { Connection } from "../../../shared/schemas";
  import type { AppsProps } from "./types";
  import {
    roomApps,
    connectionApps,
    appIdentity,
    type AppTarget,
  } from "./model";
  import AppFrame from "./AppFrame.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import { externalFileURL } from "../file-viewer/model";
  import Button from "../../lib/studio/Button.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import RadioGroup from "../../lib/studio/RadioGroup.svelte";
  import RadioGroupItem from "../../lib/studio/RadioGroupItem.svelte";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import PaneEmpty from "../../lib/components/PaneEmpty.svelte";
  import PaneHeader from "../../lib/components/PaneHeader.svelte";
  import { paneIcons } from "../documents/paneIcons";
  import LoadingState from "../../lib/components/LoadingState.svelte";
  import PaneLoading from "../../lib/components/PaneLoading.svelte";
  let { props }: { props: AppsProps } = $props();
  const owner = untrack(() => props.owner),
    view = untrack(() => owner.state),
    pinView = untrack(() => owner.pin.state),
    id = $props.id();
  const modes = untrack(
    () =>
      props.connectionModes ??
      readable<ReadonlyMap<string, ConnectionMode>>(new Map()),
  );
  let remove = $state.raw<Connection | null>(null);
  const current = () => props.current() && owner.current();
  const live = (event: Event) =>
    current() &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected;
  const busy = $derived($view.pending || $view.unconfirmed),
    apps = $derived(roomApps(props.room)),
    total = $derived(apps.length + ($view.connections?.length ?? 0)),
    empty = $derived(!total && !$view.loading && !$view.error),
    target = $derived($view.target),
    identity = $derived(
      target ? appIdentity(props.room, $view.connections || [], target) : null,
    );
  const connection = $derived(
    target?.connection === "room"
      ? null
      : $view.connections?.find(
          (connection) => connection.id === target?.connection,
        ),
  );
  const app = $derived(
    target?.connection === "room"
      ? apps.find((app) => app.tool === target.tool)
      : connection?.apps.find((app) => app.tool === target?.tool),
  );
  const pinRef = $derived(
    target
      ? target.connection === "room"
        ? target.tool
        : `${target.connection}/${target.tool}`
      : null,
  );
  const pin = $derived(
    props.room.pins?.find((pin) => pin.kind === "app" && pin.ref === pinRef),
  );
  const getConnection = (intent: Connection) =>
    $view.connections?.some(
      (item) =>
        item.id === intent.id && item.mine && item.owner === intent.owner,
    );
</script>

{#if $view.room}
  <section
    data-apps
    class="flex min-h-0 flex-1 flex-col gap-3 p-3 font-sans text-foreground"
  >
    {#if $pinView.phase === "pending" || $pinView.phase === "waiting"}<p
        role="status"
        class="text-sm text-muted-foreground"
      >
        {props.t("Esperando confirmação…")}
      </p>{/if}
    {#if $pinView.phase === "unconfirmed"}<div
        role="alert"
        class="space-y-2 text-sm"
      >
        <p>
          {props.t(
            "Ainda sem confirmação. Confira os itens fixados antes de tentar novamente.",
          )}
        </p>
        <Button
          variant="outline"
          onclick={(event) => {
            if (live(event)) owner.pin.review();
          }}>{props.t("Revisar e tentar de novo")}</Button
        >
      </div>{/if}
    {#if target}
      {#key $view.frameRevision}<Snapshot
          value={{ target, revision: $view.frameRevision }}
        >
          {#snippet children(rendered)}
            <div class="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onclick={(event) => {
                  if (
                    live(event) &&
                    owner.ownsTarget(rendered.target, rendered.revision)
                  )
                    owner.back();
                }}>← Apps</Button
              >
              <h2
                class="m-0 font-sans font-semibold tracking-normal min-w-0 flex-1 break-words text-base"
              >
                {app?.title || target.tool}
              </h2>
              <span class="rounded-control bg-muted px-2 py-1 text-xs"
                >{connection?.scope === "me"
                  ? props.t("minha")
                  : props.t("da sala")}</span
              ><Button
                variant="ghost"
                disabled={$pinView.phase !== "idle" || !identity}
                aria-pressed={!!pin}
                onclick={(event) => {
                  if (
                    live(event) &&
                    owner.ownsTarget(rendered.target, rendered.revision) &&
                    pinRef
                  )
                    owner.pin.toggle(pinRef, props.request);
                }}
                >{pin
                  ? props.t("Desafixar")
                  : props.t("Fixar na lateral")}</Button
              >{#if props.putInDocument}<Button
                  variant="ghost"
                  onclick={(event) => {
                    if (
                      live(event) &&
                      owner.ownsTarget(rendered.target, rendered.revision)
                    )
                      props.putInDocument?.(rendered.target);
                  }}>{props.t("Pôr no doc")}</Button
                >{/if}<Button
                variant="ghost"
                onclick={(event) => {
                  if (
                    live(event) &&
                    owner.ownsTarget(rendered.target, rendered.revision)
                  )
                    owner.reload();
                }}>{props.t("Recarregar")}</Button
              >{#if app && "file" in app}<!-- A room app is an HTML file: it opens alone in a new tab like any HTML, so its link can be sent (Gui #4273). --><a
                  class={buttonVariants({ variant: "ghost" })}
                  href={externalFileURL(
                    { roomId: props.room.id, id: app.file.id },
                    location.origin,
                    false,
                  )}
                  target="_blank"
                  rel="noopener noreferrer">{props.t("Abrir em outra aba")}</a
                >{/if}
            </div>
          {/snippet}</Snapshot
        >{/key}
      {#if $view.error}<p
          role="alert"
          class="break-words text-sm text-destructive"
        >
          {$view.error}
        </p>
        <Button
          variant="outline"
          onclick={(event) => {
            if (live(event)) {
              owner.load();
              owner.loadFiles(props.request, true);
            }
          }}>{props.t("Atualizar")}</Button
        >{/if}
      {#if identity && $view.connections !== null}{#key identity + ":" + $view.frameRevision}<AppFrame
            {props}
            requireOpeningConsent={$view.requireOpeningConsent}
          />{/key}
      {:else if $view.loading || (!$view.error && ($view.connections === null || !props.room.filesAll))}<PaneLoading
          label={props.t("Carregando…")}
        />
      {:else}<div class="space-y-2">
          <p role="alert">
            {props.t(
              "Esse app não está nas conexões que você pode usar nesta sala.",
            )}
          </p>
          <Button
            onclick={(event) => {
              if (live(event)) owner.back();
            }}>← Apps</Button
          >
        </div>{/if}
    {:else}
      {#snippet connect(small: boolean)}<Button
          variant={small ? "outline" : "default"}
          size={small ? "sm" : "default"}
          onclick={(event) => {
            if (live(event)) owner.form(true);
          }}>{props.t("Conectar app")}</Button
        >{/snippet}
      {#snippet connectSmall()}{@render connect(true)}{/snippet}
      {#snippet connectLarge()}{@render connect(false)}{/snippet}
      <PaneHeader
        title="Apps"
        count={total}
        action={!empty && !$view.form ? connectSmall : undefined}
      />
      {#if empty && !$view.form}<PaneEmpty
          icon={paneIcons.apps}
          title={props.t("Nenhum app ainda")}
          description={props.t(
            "Ferramentas pequenas que vivem nesta sala: uma enquete, um painel, um tracker. Seu Claude pode fazer uma, ou você conecta um app que já usa.",
          )}
          action={connectLarge}
          ask={props.t("Faz um app de enquete pra esta sala, pra gente votar.")}
          askLabel={props.t("Peça pro seu Claude")}
          onask={props.ask}
        />{/if}
      {#if $view.form}<form
          class="space-y-3 rounded-control border border-border p-3"
          onsubmit={(event) => {
            event.preventDefault();
            if (live(event) && !busy) owner.connect();
          }}
        >
          <Label for={id + "-url"}>{props.t("URL do servidor MCP")}</Label
          ><Input
            id={id + "-url"}
            value={$view.url}
            required
            placeholder="https://…/mcp"
            autocomplete="off"
            spellcheck={false}
            disabled={busy}
            oninput={(event) => {
              if (live(event))
                owner.draft(event.currentTarget.value, $view.scope);
            }}
          />
          <p class="text-xs text-muted-foreground">
            {props.t(
              "Sem token aqui: se o servidor pedir login, cada pessoa entra com a própria conta dela, e o deco.chat só diz quem é e de qual sala.",
            )}
          </p>
          <RadioGroup
            value={$view.scope}
            aria-label={props.t("Quem pode usar")}
            disabled={busy}
            onValueChange={(value) => {
              if (current() && (value === "me" || value === "room"))
                owner.draft($view.url, value);
            }}
          >
            {#each [{ value: "me", label: props.t("Só minha: só eu e meus agents") }, { value: "room", label: props.t("Da sala: todo mundo vê; cada um entra com a própria conta") }] as item (item.value)}<Label
                class="flex items-center gap-2 font-normal"
                ><RadioGroupItem value={item.value} />{item.label}</Label
              >{/each}
          </RadioGroup>
          <div class="flex gap-2">
            <Button
              variant="outline"
              disabled={$view.pending}
              onclick={(event) => {
                if (live(event)) owner.form(false);
              }}>{props.t("Cancelar")}</Button
            ><Button type="submit" disabled={busy}
              >{$view.pending
                ? props.t("Conectando…")
                : props.t("Conectar")}</Button
            >
          </div>
        </form>{/if}
      {#if $view.loading}<LoadingState label={props.t("Carregando…")} />{/if}
      {#if $view.error}<p
          role="alert"
          class="break-words text-sm text-destructive"
        >
          {$view.error}
        </p>
        <Button
          variant="outline"
          onclick={(event) => {
            if (live(event)) {
              owner.load();
              owner.loadFiles(props.request, true);
            }
          }}>{props.t("Atualizar")}</Button
        >{/if}
      {#if $view.unconfirmed}<p role="alert" class="text-sm">
          {props.t(
            "Mudança não confirmada. Ela pode ter sido salva. Confira antes de tentar de novo.",
          )}
        </p>
        <Button
          variant="outline"
          onclick={(event) => {
            if (live(event)) owner.review();
          }}>{props.t("Revisar e tentar de novo")}</Button
        >{/if}
      {#if apps.length}
        <section class="space-y-2 rounded-control border border-border p-3">
          <div class="flex items-center gap-2">
            <h3 class="m-0 font-sans font-semibold tracking-normal text-base">
              {props.t("Esta sala")}
            </h3>
          </div>
          <div class="grid gap-2">
            {#each apps as app (app.file.id)}<Button
                variant="outline"
                class="h-auto justify-start whitespace-normal text-left"
                onclick={(event) => {
                  if (live(event))
                    owner.open({ connection: "room", tool: app.tool });
                }}
                ><span
                  ><strong class="block">{app.title}</strong><small
                    class="block text-muted-foreground"
                    >{props.name(app.file.author)} · {props.ago(
                      app.file.ts,
                    )}</small
                  ></span
                ></Button
              >{/each}
          </div>
        </section>{/if}
      {#each $view.connections || [] as item (item.id)}{@const all =
          connectionApps(item)}{@const screens = all.filter(
          (app) => app.screen,
        )}{@const visible =
          screens.length && !$view.more.has(item.id) ? screens : all}
        <section
          data-connection-card={item.id}
          class="space-y-3 rounded-control border border-border p-3"
        >
          <header class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <h3
                  class="m-0 truncate font-sans text-base font-semibold tracking-normal"
                >
                  {item.title}
                </h3>
                <Badge variant="neutral"
                  >{item.scope === "me"
                    ? props.t("minha")
                    : props.t("da sala")}</Badge
                >{#if $modes.get(item.id)}{@const mode = $modes.get(
                    item.id,
                  )}<Badge
                    variant="neutral"
                    data-connection-mode={mode}
                    title={props.t(
                      mode === "direct"
                        ? "As chamadas vão do seu navegador direto pro servidor; o deco.chat só assina quem é você."
                        : "As chamadas passam pelo deco.chat (o servidor não libera chamada direta ou pede login).",
                    )}
                    >{props.t(
                      mode === "direct" ? "direto" : "via deco.chat",
                    )}</Badge
                  >{/if}
              </div>
              <p class="m-0 truncate text-xs text-muted-foreground">
                {item.host} · {props.name(item.owner)}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onclick={(event) => {
                  if (live(event)) owner.refresh(item.id);
                }}>{props.t("Atualizar")}</Button
              >{#if item.mine}<Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onclick={(event) => {
                    if (live(event)) remove = item;
                  }}>{props.t("Remover")}</Button
                >{/if}
            </div>
          </header>
          <!-- Signed in on its own login: say so, with a way out. A server without a login (it trusts the identity
               deco.chat signs) needs nothing here; an app that gets a 401 asks to sign in where it opens. -->
          {#if item.signed_in}<p class="m-0 text-xs text-muted-foreground">
              {props.t("Você entrou em {host} com a sua conta.", {
                host: item.host,
              })}
              <Button
                variant="link"
                class="h-auto px-0 text-xs text-foreground underline decoration-current/35 underline-offset-4 hover:decoration-current"
                disabled={busy}
                onclick={(event) => {
                  if (live(event)) owner.signout(item.id);
                }}>{props.t("Sair")}</Button
              >
            </p>{/if}
          {#if visible.length}<ul class="m-0 grid list-none gap-1 p-0">
              {#each visible as app (app.tool)}<li>
                  <Button
                    variant="ghost"
                    class="h-auto w-full justify-start gap-3 whitespace-normal rounded-lg px-2 py-2 text-left"
                    onclick={(event) => {
                      if (live(event))
                        owner.open({ connection: item.id, tool: app.tool });
                    }}
                    ><span
                      aria-hidden="true"
                      class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold"
                      >{app.title.slice(0, 1).toUpperCase()}</span
                    ><span class="min-w-0 flex-1"
                      ><span class="block truncate text-sm font-medium"
                        >{app.title}</span
                      ><span
                        class="line-clamp-2 block text-xs font-normal text-muted-foreground"
                        >{app.description}</span
                      ></span
                    ><span aria-hidden="true" class="text-muted-foreground"
                      >›</span
                    ></Button
                  >
                </li>{/each}
            </ul>{:else}<p class="m-0 text-xs text-muted-foreground">
              {props.t("{n} tools, nenhum app", { n: item.tools.length })}
            </p>{/if}
          {#if screens.length && screens.length < all.length}<Button
              variant="link"
              class="h-auto px-0 text-xs text-foreground underline decoration-current/35 underline-offset-4 hover:decoration-current"
              onclick={(event) => {
                if (live(event)) owner.more(item.id);
              }}
              >{$view.more.has(item.id)
                ? props.t("só as telas")
                : props.t("ver todas ({n})", { n: all.length })}</Button
            >{/if}
        </section>{/each}
    {/if}
  </section>
  {#if remove}{#key remove}<Snapshot value={remove}>
        {#snippet children(intent)}<ConfirmDialog
            open
            title={props.t("Remover conexão")}
            description={props.t(
              "Remover a conexão {name}? Os apps dela saem da sala.",
              { name: intent.title },
            )}
            confirmLabel={props.t("Remover")}
            cancelLabel={props.t("Cancelar")}
            onOpenChange={(open) => {
              if (!open && remove === intent) remove = null;
            }}
            confirmDisabled={busy}
            onconfirm={() => {
              if (current() && remove === intent && getConnection(intent)) {
                owner.remove(intent.id);
                remove = null;
              }
            }}
          />{/snippet}</Snapshot
      >{/key}{/if}
{:else if $view.denied}<section
    data-apps-denied
    class="space-y-2 p-3 font-sans text-foreground"
  >
    <p role="alert">{props.t("Você não tem acesso a esta sala.")}</p>
    <Button
      variant="outline"
      onclick={(event) => {
        if (event.currentTarget.isConnected && $view.denied)
          props.checkAccess();
      }}>{props.t("Verificar acesso novamente")}</Button
    >
  </section>
{/if}
