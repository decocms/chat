<script lang="ts">
  // Emoji reactions (Gui #2724): chips under the message (yours highlighted, who reacted in a hover card), a click toggles yours;
  // 🙂+ opens the quick ones in a bar floating above it. The Book keeps them (messages.reactions) and pushes a "reactions" event.
  import type {
    ChatActions,
    ChatBridge,
    ChatMessage,
  } from "../../app/chatTypes";
  import Icon from "../../lib/studio/Icon.svelte";
  import EmojiPicker from "../composer/EmojiPicker.svelte";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import { TOOLBAR_REACTIONS } from "./reactions";
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
  let open = $state(false);
  const all = $derived(
    Object.entries(message.reactions ?? {}).filter(([, who]) => who.length),
  );
  // On hover, the common reactions not given yet wait in the row, where the chips show up (Gui #4726): a click
  // turns one into a chip right there, so you see that it registered.
  const offered = $derived(
    TOOLBAR_REACTIONS.filter((emoji) => !all.some(([e]) => e === emoji)),
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
  function react(emoji: string) {
    open = false;
    void actions.request({ t: "react", id: message.id, emoji });
  }
</script>

<!-- The chips (yours highlighted, who reacted on hover), the common ones on hover, then a button that opens the emoji
     picker. With no reaction yet, the row shows only while the mouse is on the message. -->
<div
  data-message-reactions
  class="flex flex-wrap items-center gap-1 {all.length || open
    ? ''
    : 'hidden pointer-fine:group-hover:flex pointer-fine:group-has-focus-visible:flex'}"
>
  {#each all as [emoji, list] (emoji)}<Tooltip>
      <TooltipTrigger>
        {#snippet child({ props })}<button
            {...props}
            type="button"
            aria-label={`${emoji} ${who(list)}`}
            aria-pressed={list.includes(me)}
            class="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-solid px-2 text-base leading-none transition-colors {list.includes(
              me,
            )
              ? 'border-brand-purple/60 bg-brand-purple/15 hover:bg-brand-purple/25'
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
  {#each offered as emoji (emoji)}<button
      type="button"
      aria-label={vb.t("Reagir com {emoji}", { emoji })}
      data-offer-react={emoji}
      class="hidden h-7 cursor-pointer items-center rounded-full border border-dashed border-border bg-transparent px-2 text-base leading-none opacity-70 transition-[opacity,border-color] hover:border-solid hover:opacity-100 pointer-fine:group-hover:inline-flex pointer-fine:group-has-focus-visible:inline-flex"
      onclick={() => react(emoji)}>{emoji}</button
    >{/each}
  <!-- Add another reaction, right next to the ones there (like Discord): the full emoji picker. -->
  <button
    type="button"
    aria-label={vb.t("Reagir a esta mensagem")}
    title={vb.t("Reagir a esta mensagem")}
    data-add-reaction
    class="inline-flex h-7 cursor-pointer items-center justify-center rounded-full border border-solid border-transparent bg-muted px-2 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
    onclick={() => (open = true)}><Icon icon="face-smile" size={16} /></button
  >
</div>
<EmojiPicker t={vb.t} bind:open onpick={react} />
