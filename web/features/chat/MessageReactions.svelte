<script lang="ts">
  // Emoji reactions (Gui #2724): chips under the message (yours highlighted, who reacted in a hover card), a click toggles yours;
  // 🙂+ opens the quick ones in a bar floating above it. The Book keeps them (messages.reactions) and pushes a "reactions" event.
  import type {
    ChatActions,
    ChatBridge,
    ChatMessage,
  } from "../../app/chatTypes";
  import Icon from "../../lib/studio/Icon.svelte";
  import { FaceSmile } from "../../lib/studio/icons";
  import EmojiPicker from "../composer/EmojiPicker.svelte";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
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

<!-- The chips (yours highlighted, who reacted on hover), then a button that opens the emoji picker. The row shows
     once there's a reaction; before that, the quick ones live in the message's floating toolbar. -->
<div
  data-message-reactions
  class="flex flex-wrap items-center gap-1 {all.length || open ? '' : 'hidden'}"
>
  {#each all as [emoji, list] (emoji)}<Tooltip>
      <TooltipTrigger>
        {#snippet child({ props })}<button
            {...props}
            type="button"
            aria-label={`${emoji} ${who(list)}`}
            aria-pressed={list.includes(me)}
            class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-lg leading-none {list.includes(
              me,
            )
              ? 'border-primary bg-accent'
              : 'border-border bg-background'}"
            onclick={() => react(emoji)}
            >{emoji}
            <b class="text-sm font-semibold text-muted-foreground"
              >{list.length}</b
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
  <!-- Add another reaction, right next to the ones there (like Discord): the full emoji picker. -->
  <button
    type="button"
    aria-label={vb.t("Reagir a esta mensagem")}
    title={vb.t("Reagir a esta mensagem")}
    data-native-add-reaction
    class="inline-flex h-8 cursor-pointer items-center justify-center rounded-full border border-transparent bg-muted px-2.5 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
    onclick={() => (open = true)}><Icon icon={FaceSmile} size={18} /></button
  >
</div>
<EmojiPicker t={vb.t} bind:open onpick={react} />
