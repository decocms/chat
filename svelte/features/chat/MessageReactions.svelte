<script lang="ts">
  // Emoji reactions (Gui #2724): chips under the message (yours highlighted, who on hover), a click toggles yours;
  // 🙂+ opens the quick ones in a bar floating above it. The Book keeps them (messages.reactions) and pushes a "reactions" event.
  import type { ChatActions, ChatBridge, ChatMessage } from "../../chatTypes";
  import Popover from "../../lib/studio/Popover.svelte";
  import PopoverContent from "../../lib/studio/PopoverContent.svelte";
  import PopoverTrigger from "../../lib/studio/PopoverTrigger.svelte";
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
  <Popover bind:open>
    <PopoverTrigger
      aria-label={vb.t("Reagir a esta mensagem")}
      class="tw:inline-flex tw:min-h-7 tw:items-center tw:rounded-full tw:border tw:border-border tw:bg-background tw:px-2 tw:text-sm tw:text-muted-foreground tw:transition-opacity tw:duration-150 {all.length ||
      open
        ? ''
        : 'tw:hidden tw:md:inline-flex tw:md:opacity-0 tw:md:group-hover:opacity-100 tw:md:focus:opacity-100'}"
      >🙂+</PopoverTrigger
    >
    <PopoverContent
      side="top"
      align="start"
      sideOffset={6}
      data-vb-native
      class="tw:flex tw:w-auto tw:gap-0.5 tw:rounded-full tw:p-1 tw:font-sans"
    >
      {#each QUICK as emoji}<button
          type="button"
          aria-label={emoji}
          class="tw:flex tw:size-9 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:text-xl tw:leading-none tw:transition-transform tw:duration-150 tw:ease-out tw:hover:scale-110 tw:hover:bg-accent tw:focus-visible:outline-2 tw:focus-visible:outline-ring tw:motion-reduce:transition-none"
          onclick={() => react(emoji)}>{emoji}</button
        >{/each}
    </PopoverContent>
  </Popover>
</div>
