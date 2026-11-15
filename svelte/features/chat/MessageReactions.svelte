<script lang="ts">
  // Emoji reactions (Gui #2724): chips under the message (yours highlighted, who on hover), a click toggles yours;
  // 🙂+ opens the quick ones. The Book keeps them (messages.reactions) and pushes a "reactions" event.
  import type { ChatActions, ChatBridge, ChatMessage } from "../../chatTypes";
  let {
    message,
    me,
    actions,
    vb,
  }: {
    message: ChatMessage;
    me: string;
    actions: ChatActions;
    vb: ChatBridge;
  } = $props();
  const QUICK = ["👍", "❤️", "😂", "🎉", "👀", "✅", "🙏", "🔥"];
  let open = $state(false);
  const all = $derived(
    Object.entries(message.reactions ?? {}).filter(([, who]) => who.length),
  );
  const who = (list: string[]) =>
    list
      .map((w) =>
        w.endsWith("#agent")
          ? vb.t("Claude de {who}", { who: vb.name(w.slice(0, -6)) })
          : vb.name(w),
      )
      .join(", ");
  function react(emoji: string) {
    open = false;
    void actions.request({ t: "react", id: message.id, emoji });
  }
</script>

<div
  data-message-reactions
  class="tw:mt-1 tw:flex tw:flex-wrap tw:items-center tw:gap-1 {all.length ||
  open
    ? ''
    : 'tw:md:-mt-1 tw:md:h-0 tw:md:overflow-visible'}"
>
  {#each all as [emoji, list] (emoji)}<button
      type="button"
      title={who(list)}
      aria-pressed={list.includes(me)}
      class="tw:inline-flex tw:min-h-7 tw:items-center tw:gap-1 tw:rounded-full tw:border tw:px-2 tw:text-sm {list.includes(
        me,
      )
        ? 'tw:border-primary tw:bg-accent'
        : 'tw:border-border tw:bg-background'}"
      onclick={() => react(emoji)}
      >{emoji}
      <b class="tw:text-xs tw:font-semibold tw:text-muted-foreground"
        >{list.length}</b
      ></button
    >{/each}
  <button
    type="button"
    aria-label={vb.t("Reagir a esta mensagem")}
    aria-expanded={open}
    class="tw:inline-flex tw:min-h-7 tw:items-center tw:rounded-full tw:border tw:border-border tw:bg-background tw:px-2 tw:text-sm tw:text-muted-foreground {all.length ||
    open
      ? ''
      : 'tw:hidden tw:md:inline-flex tw:md:opacity-0 tw:md:group-hover:opacity-100 tw:md:focus:opacity-100'}"
    onclick={() => (open = !open)}>🙂+</button
  >
  {#if open}<div
      role="menu"
      class="tw:flex tw:gap-0.5 tw:rounded-full tw:border tw:border-border tw:bg-background tw:p-1"
    >
      {#each QUICK as emoji}<button
          type="button"
          role="menuitem"
          class="tw:rounded-full tw:p-1 tw:text-lg tw:leading-none tw:hover:bg-muted"
          onclick={() => react(emoji)}>{emoji}</button
        >{/each}
    </div>{/if}
</div>
