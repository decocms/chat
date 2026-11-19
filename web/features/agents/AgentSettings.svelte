<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import type { AgentSettingsProps } from "./types";
  import { grantGroups } from "./model";
  import { agentText } from "./copy";
  import Heading from "../../lib/ui/Heading.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Checkbox from "../../lib/studio/Checkbox.svelte";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import SetupInstructions from "./SetupInstructions.svelte";
  let { owner, origin, vb, lang = "pt" }: AgentSettingsProps = $props();
  const view = untrack(() => owner.state),
    text = (key: Parameters<typeof agentText>[1]) => agentText(lang, key);
  const groups = $derived(
    $view.grants ? grantGroups($view.grants, Date.now()) : [],
  );
  const busy = $derived(
    $view.phase === "pending" || $view.phase === "unconfirmed",
  );
  let selected = $state<Set<string>>(new Set()),
    confirm = $state(false),
    target = $state.raw<string[]>([]),
    signature = $state("");
  let active = true,
    known = new Set<string>();
  const identity = (ids: readonly string[]) =>
    JSON.stringify(
      $view.grants?.agents.filter((grant) => ids.includes(grant.id)),
    );
  $effect(() => {
    const current = groups;
    untrack(() => {
      const ids = new Set(
        current.flatMap((group) => group.rows.map((row) => row.grant.id)),
      );
      const next = new Set([...selected].filter((id) => ids.has(id)));
      for (const group of current)
        for (const row of group.rows)
          if (!known.has(row.grant.id) && row.stale) next.add(row.grant.id);
      known = ids;
      selected = next;
    });
  });
  $effect(() => {
    if (confirm && identity(target) !== signature) confirm = false;
  });
  function change(id: string, checked: boolean) {
    if (!active || !owner.current()) return;
    const next = new Set(selected);
    checked ? next.add(id) : next.delete(id);
    selected = next;
  }
  function ask() {
    if (!active || busy || !selected.size) return;
    target = [...selected];
    signature = identity(target);
    confirm = true;
  }
  function revoke() {
    if (
      !active ||
      !owner.current() ||
      !confirm ||
      busy ||
      identity(target) !== signature
    )
      return;
    void owner.revoke(target);
  }
  onMount(() => owner.watch());
  onDestroy(() => {
    active = false;
  });
</script>

<section
  data-agent-settings
  class="space-y-3 font-sans text-sm tracking-normal [font-variation-settings:normal] text-foreground"
>
  {#if !$view.grants && $view.loading}<p
      role="status"
      class="m-0 text-muted-foreground"
    >
      {text("loading")}
    </p>{/if}
  {#if $view.readError}<div role="alert" class="space-y-2 text-destructive">
      <p class="m-0">{text("readFailed")}</p>
      <Button
        variant="outline"
        onclick={() => {
          if (active) void owner.refresh();
        }}>{text("retry")}</Button
      >
    </div>{/if}
  {#if $view.grants?.agents.length}
    <!-- One card: a header row per client, then one row per connection (check to remove). -->
    <div
      class="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border"
      aria-label={text("connectedTitle")}
      role="group"
    >
      {#each groups as group (group.client)}<section
          class="divide-y divide-border"
        >
          <Heading
            level={3}
            class="m-0 flex items-center justify-between bg-muted/40 px-4 py-2.5 font-sans text-sm font-semibold"
            >{group.client}<span
              class="text-xs font-normal text-muted-foreground"
              >{group.rows.length}</span
            ></Heading
          >{#each group.rows as { grant } (grant.id)}<label
              class="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3 hover:bg-accent/40"
              ><Checkbox
                bind:checked={
                  () => selected.has(grant.id),
                  (checked) => {
                    if (active) change(grant.id, checked);
                  }
                }
              /><span class="flex min-w-0 flex-col gap-0.5"
                ><span>{text("connectedAt")} {vb.ago(grant.connected_at)}</span
                ><small class="text-xs text-muted-foreground"
                  >{grant.used_at
                    ? `${text("used")} ${vb.ago(grant.used_at)}`
                    : text(
                        grant.used_at === null ? "neverUsed" : "unknownUse",
                      )}</small
                ></span
              ></label
            >{/each}
        </section>{/each}
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onclick={(event) => {
          if (active && event.currentTarget.isConnected)
            selected = new Set(
              groups.flatMap((group) =>
                group.rows.slice(1).map((row) => row.grant.id),
              ),
            );
        }}>{text("markOld")}</Button
      ><Button
        size="sm"
        variant="outline"
        class="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={busy || !selected.size}
        onclick={(event) => {
          if (event.currentTarget.isConnected) ask();
        }}>{text("revoke")} ({selected.size})</Button
      ><span class="flex-1"></span><Button
        variant="ghost"
        size="sm"
        disabled={$view.loading}
        onclick={() => {
          if (active) void owner.refresh();
        }}>{text("refresh")}</Button
      >
    </div>
  {:else if $view.grants}<SetupInstructions
      {origin}
      {lang}
      current={owner.current}
    />{/if}
  {#if $view.phase === "error"}<p role="alert" class="m-0 text-destructive">
      {text("revokeFailed")}
    </p>{/if}
  {#if $view.phase === "unconfirmed"}<div
      role="status"
      class="space-y-2 text-muted-foreground"
    >
      <p class="m-0">{text("unconfirmed")}</p>
      <Button
        variant="outline"
        onclick={() => {
          if (active && owner.current()) {
            owner.review();
            confirm = false;
          }
        }}>{text("reviewed")}</Button
      >
    </div>{/if}
</section>
<ConfirmDialog
  bind:open={confirm}
  title={text("revokeTitle")}
  description={text("revokeBody")}
  confirmLabel={`${text("revoke")} (${target.length})`}
  cancelLabel={text("cancel")}
  busy={$view.phase === "pending"}
  confirmDisabled={busy || !target.length || identity(target) !== signature}
  error={$view.phase === "error" ? text("revokeFailed") : ""}
  onconfirm={revoke}
/>
