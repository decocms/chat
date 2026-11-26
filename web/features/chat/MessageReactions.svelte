<script lang="ts">
  // Emoji reactions (Gui #2724): chips under the message (yours highlighted, who reacted in a hover card), a click toggles yours;
  // the quick ones live in the hover toolbar, with the actions (Valls); 🙂 next to the chips opens every emoji in a popover. The Book keeps them
  // (messages.reactions) and pushes a "reactions" event.
  import type {
    ChatActions,
    ChatBridge,
    ChatMessage,
  } from "../../app/chatTypes";
  import Icon from "../../lib/studio/Icon.svelte";
  import EmojiGrid from "../composer/EmojiGrid.svelte";
  import Popover from "../../lib/studio/Popover.svelte";
  import PopoverContent from "../../lib/studio/PopoverContent.svelte";
  import PopoverTrigger from "../../lib/studio/PopoverTrigger.svelte";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import { OWN_REACTION } from "./reactions";
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
  // The emoji popover. While it is open the row stays as it was (the quick ones too): the pointer is in the popover,
  // not on the message, and nothing under it moves or disappears.
  let open = $state(false),
    search = $state<HTMLInputElement | null>(null),
    grid = $state<HTMLDivElement | null>(null);
  const all = $derived(
    Object.entries(message.reactions ?? {}).filter(([, who]) => who.length),
  );
  const nameOf = (w: string) =>
    w === me
      ? vb.t("você")
      : w.endsWith("#agent")
        ? vb.t("Claude de {who}", { who: vb.name(w.slice(0, -6)) })
        : vb.name(w);
  const who = (list: string[]) => list.map(nameOf).join(", ");
  // The hover card's line, like Discord's: "Ana, Bruno and you reacted" (past 6 names, "and N more").
  const reacted = (list: string[]) => {
    const names = list.map(nameOf),
      shown = names.slice(0, 6),
      rest = names.length - shown.length;
    const people = rest
      ? vb.t("{names} e mais {n}", { names: shown.join(", "), n: rest })
      : shown.length > 1
        ? vb.t("{names} e {last}", {
            names: shown.slice(0, -1).join(", "),
            last: shown.at(-1) ?? "",
          })
        : (shown[0] ?? "");
    return names.length > 1
      ? vb.t("{people} reagiram", { people })
      : vb.t("{people} reagiu", { people });
  };
  /** Shown while the mouse is on the message (or focus is in it), or while the emoji popover is open. */
  const HOVER_ONLY =
    "invisible opacity-0 transition-[opacity,visibility] duration-150 pointer-fine:group-hover:visible pointer-fine:group-hover:opacity-100 pointer-fine:group-has-focus-visible:visible pointer-fine:group-has-focus-visible:opacity-100 in-data-[picking]:visible in-data-[picking]:opacity-100 motion-reduce:transition-none";
  function react(emoji: string) {
    open = false;
    void actions.request({ t: "react", id: message.id, emoji });
  }
</script>

<!-- The chips (yours highlighted, who reacted on hover), then a button that opens the emoji popover. The hover-only
     button always takes its place, hidden: showing it moves nothing (no layout shift on hover). 24px, the row's height. -->
<div
  data-message-reactions
  data-picking={open || undefined}
  class="flex flex-wrap items-center gap-1"
>
  {#each all as [emoji, list] (emoji)}<Tooltip>
      <TooltipTrigger>
        {#snippet child({ props })}<button
            {...props}
            type="button"
            aria-label={`${emoji} ${who(list)}`}
            aria-pressed={list.includes(me)}
            class="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-full border border-solid px-2 text-base leading-none transition-colors {list.includes(
              me,
            )
              ? OWN_REACTION
              : 'border-transparent bg-muted hover:border-border'}"
            onclick={() => react(emoji)}
            >{emoji}
            <b
              class="text-xs tabular-nums {list.includes(me)
                ? 'font-semibold text-brand-purple-text'
                : 'font-medium text-muted-foreground'}">{list.length}</b
            ></button
          >{/snippet}
      </TooltipTrigger>
      <!-- Who reacted, on hover (and focus): the emoji big, then the names. -->
      <TooltipContent
        side="top"
        sideOffset={6}
        data-reaction-who={emoji}
        class="flex max-w-64 items-center gap-2.5 py-2 text-left"
        ><span aria-hidden="true" class="text-2xl leading-none">{emoji}</span
        ><span class="min-w-0 font-normal leading-4">{reacted(list)}</span
        ></TooltipContent
      >
    </Tooltip>{/each}
  <!-- Every other emoji, in a popover next to this button (like Discord's and Slack's "add reaction"). Only on hover,
       also when the message has chips (Gimenes #5477); phones react from the long press. -->
  <Popover bind:open>
    <PopoverTrigger>
      {#snippet child({ props })}<button
          {...props}
          type="button"
          aria-label={vb.t("Reagir a esta mensagem")}
          title={vb.t("Reagir a esta mensagem")}
          data-add-reaction
          class="{HOVER_ONLY} inline-flex h-6 pointer-coarse:hidden cursor-pointer items-center justify-center rounded-full border border-solid border-transparent bg-muted px-2 text-muted-foreground transition-colors hover:border-border hover:text-foreground data-[state=open]:border-border data-[state=open]:text-foreground"
          ><Icon icon="face-smile" size={16} /></button
        >{/snippet}
    </PopoverTrigger>
    <PopoverContent
      side="top"
      align="start"
      sideOffset={6}
      data-emoji-popover={message.id}
      class="flex w-80 flex-col gap-2 p-3 font-sans text-sm text-foreground"
      onOpenAutoFocus={(event) => {
        const target = window.matchMedia("(pointer: coarse)").matches
          ? grid?.querySelector("button") || null
          : search;
        if (target) {
          event.preventDefault();
          target.focus();
        }
      }}
    >
      <EmojiGrid t={vb.t} bind:search bind:grid onpick={react} />
    </PopoverContent>
  </Popover>
</div>
