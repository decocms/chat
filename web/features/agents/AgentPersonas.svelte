<script lang="ts">
  import { onDestroy } from "svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  import DropdownMenu from "../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuContent from "../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuItem from "../../lib/studio/DropdownMenuItem.svelte";
  import DropdownMenuTrigger from "../../lib/studio/DropdownMenuTrigger.svelte";
  import { cn } from "../../lib/studio/utils";
  import {
    AGENT_TILES,
    agentMark,
    type AgentProvider,
  } from "../../lib/components/agent";
  import { AGENT_KINDS, type AgentKind } from "../../../shared/agentKinds";
  import { freeName } from "../../../shared/agentNames";
  import type {
    AgentsResult,
    RoomMachine,
    RoomPersona,
  } from "../../../shared/schemas";
  import type { RoomAgentSession } from "./room";
  import { roomAgentText, type RoomAgentCopyKey } from "./roomCopy";
  /**
   * Your agents in this room (Gimenes #6283, #6288): one flat list, each agent like a person: its kind's logo, its
   * name (its @ in every room), its kind and machine, and its switch for this room. "Adicionar agent" picks a
   * machine, one of the agents installed there, and a name. The runner opens Claude and Codex today; Antigravity
   * and OpenCode come later, so they show as "em breve".
   */
  let {
    owner,
    data,
    lang = "pt",
    onother,
  }: {
    owner: RoomAgentSession;
    data: AgentsResult;
    lang?: "pt" | "en";
    /** The other ways to connect (cloud, a session): the tiles under the list. */
    onother(): void;
  } = $props();
  const text = (key: RoomAgentCopyKey, vars?: Record<string, string>) =>
    roomAgentText(lang, key).replace(/\{(\w+)\}/g, (_, k) => vars?.[k] ?? "");
  /** The kinds the runner can open now. */
  const RUNS: readonly AgentKind[] = ["claude", "codex"];
  const KIND_NAME: Record<AgentKind, string> = {
    claude: "Claude Code",
    codex: "Codex",
    agy: "Antigravity",
    opencode: "OpenCode",
  };
  const TILE: Record<AgentKind, AgentProvider | null> = {
    claude: "claude",
    codex: "codex",
    agy: "gemini",
    opencode: null,
  };
  const personas = $derived(data.personas ?? []);
  const computers = $derived(
    (data.machines ?? []).filter((m) => m.kind !== "sandbox"),
  );
  /** A computer that reports an address for a name (192.168.…) reads as "Computer". */
  const machineName = (name: string) =>
    /^\d{1,3}(\.\d{1,3}){3}$|^localhost$/i.test(name)
      ? lang === "en"
        ? "Computer"
        : "Computador"
      : name;
  const line = (p: RoomPersona) =>
    [
      KIND_NAME[p.kind],
      machineName(p.machine_name),
      p.online ? "" : text("personaOffline"),
    ]
      .filter(Boolean)
      .join(" · ");

  let adding = $state(false),
    machine = $state(""),
    kind = $state<AgentKind | "">(""),
    name = $state(""),
    renaming = $state(""),
    newName = $state(""),
    busy = $state(false),
    error = $state(""),
    active = true;
  const picked = $derived(computers.find((m) => m.id === machine));
  /** What a machine offers for each kind: its version, "não instalado", or "em breve". Without kinds (an older
   *  app), Claude only. */
  const offer = (m: RoomMachine | undefined, k: AgentKind) => {
    if (!RUNS.includes(k)) return { ok: false, hint: text("personaSoon") };
    if (!m?.kinds)
      return k === "claude"
        ? { ok: true, hint: "" }
        : { ok: false, hint: text("personaMissing") };
    const v = m.kinds[k];
    return v === undefined
      ? { ok: false, hint: text("personaMissing") }
      : { ok: true, hint: v ? `v${v}` : "" };
  };
  const suggested = $derived(
    kind
      ? freeName(
          kind,
          personas.map((p) => p.name),
        )
      : "",
  );
  function startAdd() {
    error = "";
    adding = true;
    machine = computers.find((m) => m.online)?.id ?? computers[0]?.id ?? "";
    kind = RUNS.find((k) => offer(picked, k).ok) ?? "";
    name = "";
  }
  $effect(() => {
    // A new machine picked: keep the kind only if that machine has it.
    if (kind && !offer(picked, kind).ok)
      kind = RUNS.find((k) => offer(picked, k).ok) ?? "";
  });
  const errorText = (status: number) =>
    status === 409
      ? text("personaNameTaken")
      : status === 400
        ? text("personaNameBad")
        : text("personaFailed");
  async function add() {
    if (!machine || !kind || busy) return;
    busy = true;
    error = "";
    const status = await owner.addPersona({
      machine,
      kind,
      ...(name.trim() ? { name: name.trim() } : {}),
    });
    if (!active) return;
    busy = false;
    if (status === null) adding = false;
    else error = errorText(status);
  }
  async function rename(p: RoomPersona) {
    if (busy) return;
    if (!newName.trim() || newName.trim() === p.name) {
      renaming = "";
      return;
    }
    busy = true;
    error = "";
    const status = await owner.renamePersona(p.id, newName.trim());
    if (!active) return;
    busy = false;
    if (status === null) renaming = "";
    else error = errorText(status);
  }
  async function remove(p: RoomPersona) {
    if (busy) return;
    busy = true;
    error = "";
    const status = await owner.removePersona(p.id);
    if (!active) return;
    busy = false;
    if (status !== null) error = errorText(status);
  }
  onDestroy(() => (active = false));
  const ROW =
    "flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left font-sans text-sm text-foreground";
</script>

{#snippet logo(k: AgentKind, size: "sm" | "md", dim = false)}
  {@const t = TILE[k]}<span
    aria-hidden="true"
    class={cn(
      "flex shrink-0 items-center justify-center",
      size === "md" ? "size-8 rounded-lg text-sm" : "size-6 rounded-md text-xs",
      t ? AGENT_TILES[t] : "bg-muted text-foreground",
      dim && "opacity-50",
    )}
    >{#if t}{agentMark(t)}{:else}<Icon
        icon="monitor-01"
        class="size-3.5"
      />{/if}</span
  >
{/snippet}

<section data-agent-personas class="grid gap-0.5">
  <p class="m-0 px-2 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground">
    {text("personasTitle")}
  </p>
  {#each personas as p (p.id)}
    {#if renaming === p.id}
      <form
        data-agent-persona-rename={p.id}
        class="flex items-center gap-1.5 px-2 py-1"
        onsubmit={(event) => {
          event.preventDefault();
          void rename(p);
        }}
      >
        {@render logo(p.kind, "md")}
        <Input
          bind:value={newName}
          aria-label={text("personaName")}
          autocomplete="off"
          spellcheck={false}
          class="h-8 min-w-0 flex-1"
        />
        <Button type="submit" size="xs" disabled={busy}
          >{text("personaRenameSave")}</Button
        >
      </form>
    {:else}
      <div
        data-agent-persona={p.id}
        data-agent-persona-on={p.on}
        class="flex min-w-0 items-center gap-1 rounded-lg pr-1 hover:bg-accent"
      >
        <div class={cn(ROW, !p.on && "text-muted-foreground")}>
          <span class="relative shrink-0"
            >{@render logo(p.kind, "md", !p.on)}<span
              class={cn(
                "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-popover",
                p.on && p.listening
                  ? "bg-brand"
                  : p.online
                    ? "bg-warning"
                    : "bg-muted-foreground",
              )}
            ></span></span
          ><span class="grid min-w-0 flex-1"
            ><span class="truncate text-sm font-medium">@{p.name}</span><span
              class="truncate text-xs text-muted-foreground">{line(p)}</span
            ></span
          >
        </div>
        <Switch
          checked={p.on}
          onCheckedChange={(on) => {
            if (owner.current()) void owner.delivery({ persona: p.id }, on);
          }}
          aria-label={text("personaSwitch", { name: `@${p.name}` })}
        />
        <DropdownMenu>
          <DropdownMenuTrigger>
            {#snippet child({ props })}<IconButton
                {...props}
                variant="ghost"
                size="icon-sm"
                label={text("personaMenu", { name: `@${p.name}` })}
                data-agent-persona-menu={p.id}
                ><Icon icon="dots-vertical" /></IconButton
              >{/snippet}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            class="w-44 font-sans"
          >
            <DropdownMenuItem
              onSelect={() => {
                error = "";
                newName = p.name;
                renaming = p.id;
              }}
              ><Icon icon="pencil-01" />{text(
                "personaRename",
              )}</DropdownMenuItem
            >
            <DropdownMenuItem
              variant="destructive"
              data-agent-persona-remove={p.id}
              onSelect={() => void remove(p)}
              ><Icon icon="trash-01" />{text("personaRemove")}</DropdownMenuItem
            >
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    {/if}
  {/each}

  {#if adding}
    <form
      data-agent-persona-add
      class="mt-1 grid gap-2 rounded-xl bg-muted p-2"
      onsubmit={(event) => {
        event.preventDefault();
        void add();
      }}
    >
      {#if !computers.length}<p class="m-0 px-1 text-xs text-muted-foreground">
          {text("personaNoMachine")}
        </p>{:else}
        <div
          role="radiogroup"
          aria-label={text("personaMachine")}
          class="grid gap-0.5"
        >
          <p class="m-0 px-1 text-xs font-medium text-muted-foreground">
            {text("personaMachine")}
          </p>
          {#each computers as m (m.id)}<button
              type="button"
              role="radio"
              aria-checked={machine === m.id}
              data-agent-add-machine={m.id}
              class={cn(
                ROW,
                "min-h-9 cursor-pointer hover:bg-accent",
                machine === m.id && "bg-background",
              )}
              onclick={() => (machine = m.id)}
              ><Icon icon="app-laptop" class="size-4 shrink-0" /><span
                class="min-w-0 flex-1 truncate">{machineName(m.name)}</span
              >{#if !m.online}<span class="text-xs text-muted-foreground"
                  >{text("personaOffline")}</span
                >{/if}{#if machine === m.id}<Icon
                  icon="check"
                  class="size-4 shrink-0"
                />{/if}</button
            >{/each}
        </div>
        <div
          role="radiogroup"
          aria-label={text("personaKind")}
          class="grid gap-0.5"
        >
          <p class="m-0 px-1 text-xs font-medium text-muted-foreground">
            {text("personaKind")}
          </p>
          {#each AGENT_KINDS as k (k)}
            {@const o = offer(picked, k)}<button
              type="button"
              role="radio"
              aria-checked={kind === k}
              disabled={!o.ok}
              data-agent-add-kind={k}
              class={cn(
                ROW,
                "min-h-9 enabled:cursor-pointer enabled:hover:bg-accent disabled:text-muted-foreground",
                kind === k && "bg-background",
              )}
              onclick={() => (kind = k)}
              >{@render logo(k, "sm", !o.ok)}<span
                class="min-w-0 flex-1 truncate">{KIND_NAME[k]}</span
              >{#if o.hint}<span class="text-xs text-muted-foreground"
                  >{o.hint}</span
                >{/if}{#if kind === k}<Icon
                  icon="check"
                  class="size-4 shrink-0"
                />{/if}</button
            >
          {/each}
          {#if picked && !picked.kinds}<p
              class="m-0 px-1 text-xs text-muted-foreground"
            >
              {text("personaOldApp")}
            </p>{/if}
        </div>
        <label class="grid gap-1">
          <span class="px-1 text-xs font-medium text-muted-foreground"
            >{text("personaName")}</span
          ><Input
            bind:value={name}
            placeholder={suggested}
            autocomplete="off"
            spellcheck={false}
            data-agent-add-name
            class="h-8 bg-background"
          />
        </label>{/if}
      {#if error}<p class="m-0 px-1 text-xs text-destructive" role="alert">
          {error}
        </p>{/if}
      <div class="flex justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onclick={() => (adding = false)}>{text("personaCancel")}</Button
        ><Button
          type="submit"
          size="xs"
          disabled={busy || !machine || !kind}
          data-agent-add-save>{text("personaSave")}</Button
        >
      </div>
    </form>
  {:else}
    {#if error}<p class="m-0 px-2 text-xs text-destructive" role="alert">
        {error}
      </p>{/if}
    <button
      type="button"
      data-agent-persona-new
      class={cn(
        ROW,
        "min-h-10 cursor-pointer text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
      onclick={startAdd}
      ><span class="flex size-8 shrink-0 items-center justify-center"
        ><Icon icon="plus" class="size-4" /></span
      >{text("personaAdd")}</button
    >
    <button
      type="button"
      data-agent-more
      class="flex h-8 w-full cursor-pointer items-center rounded-lg border-0 bg-transparent px-2 text-left font-sans text-xs text-muted-foreground hover:text-foreground"
      onclick={onother}>{text("personaOther")}</button
    >
  {/if}
</section>
