<script lang="ts">
  import { untrack } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { cn } from "../../lib/studio/utils";
  import type { ApplicationInbox, InboxBinding } from "./inbox";
  import { inboxAsks, roomInboxModel } from "./roomInboxModel";

  /**
   * The Inbox's own control: "Resolve all asks". The Inbox always shows all rooms.
   * The home Inbox's bar draws it (desktop, HomeInbox); the Inbox draws it on phones.
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
