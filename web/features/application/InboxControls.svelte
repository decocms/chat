<script lang="ts">
  import { untrack } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { cn } from "../../lib/studio/utils";
  import type { ApplicationInbox, InboxBinding } from "./inbox";
  import { inboxAsks, roomInboxModel } from "./roomInboxModel";

  /**
   * The Inbox's own controls: which rooms it shows and "Resolve all asks".
   * The room's top bar draws them (desktop); the Inbox draws them on phones.
   */
  let {
    owner,
    binding,
    t,
    class: className,
  }: {
    owner: ApplicationInbox;
    binding: InboxBinding;
    t: (text: string, vars?: Record<string, string | number>) => string;
    class?: string;
  } = $props();
  const inbox = untrack(() => owner.state);
  const asks = $derived(
    inboxAsks(
      roomInboxModel($inbox.data, binding.roomId ?? "", $inbox.all).messages,
      $inbox.hidden,
    ),
  );
  const live = (event: Event) =>
    owner.owns(binding) &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected;
</script>

<div data-inbox-controls class={cn("flex items-center gap-1", className)}>
  <!-- The home's Inbox has no room: it always shows all rooms, so no scope. -->
  {#if binding.roomId}<div
      role="group"
      aria-label={t("Salas")}
      class="inline-flex items-center rounded-lg bg-muted p-0.5"
    >
      {#each [false, true] as all}<Button
          size="sm"
          variant="ghost"
          aria-pressed={$inbox.all === all}
          class={cn(
            "h-7 rounded-md px-2.5 text-xs font-normal text-muted-foreground",
            $inbox.all === all &&
              "bg-background text-foreground shadow-xs hover:bg-background",
          )}
          onclick={(event) => {
            if (live(event)) owner.tab(binding, all);
          }}>{t(all ? "Todas as salas" : "Esta sala")}</Button
        >{/each}
    </div>{/if}
  <Button
    data-inbox-resolve-all
    size="sm"
    variant="outline"
    class="h-7 text-xs"
    disabled={!asks.length}
    onclick={(event) => {
      if (live(event)) owner.resolveLater(binding, asks);
    }}
    ><Icon icon="check-circle" size={14} />{asks.length
      ? t("Resolver todos os pedidos ({n})", { n: asks.length })
      : t("Resolver todos os pedidos")}</Button
  >
</div>
