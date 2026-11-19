<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { Room, Message } from "../../../shared/room";
  import type { ChatActions, ChatBridge } from "../../chatTypes";
  import type { Choices } from "./model";
  import { answerOf, canAnswer } from "./model";
  import Icon from "../../lib/studio/Icon.svelte";
  import { Check } from "../../lib/studio/icons";
  import { buttonVariants } from "../../lib/studio/button";
  import { cn } from "../../lib/studio/utils";
  let {
    choices,
    message,
    room,
    actions,
    vb,
  }: {
    choices: Choices;
    message: Message;
    room: Room;
    actions: ChatActions;
    vb: ChatBridge;
  } = $props();
  let active = true,
    selected = $state<number[]>([]);
  let previous = untrack(() => message.choices);
  $effect(() => {
    const source = message.choices;
    if (source !== previous)
      untrack(() => {
        previous = source;
        selected = [];
      });
  });
  onDestroy(() => {
    active = false;
  });
  const answer = $derived(answerOf(room, message));
  const actionable = $derived(canAnswer(room, message) && !choices.closed);
  const picked = $derived(new Set(answer?.text.split(" · ") || []));
  function choose(index: number, checked = true) {
    const canonical =
      room.messages.find((m) => m.id === message.id) ||
      room.origins?.find((m) => m.id === message.id);
    if (
      !active ||
      !canonical ||
      canonical.choices !== message.choices ||
      !canAnswer(room, canonical) ||
      choices.closed
    )
      return;
    if (choices.multi)
      selected = checked
        ? [...selected.filter((i) => i !== index), index].sort((a, b) => a - b)
        : selected.filter((i) => i !== index);
    else selected = [index];
    const text =
      index === -1 && checked
        ? ""
        : selected
            .filter((i) => i >= 0)
            .map((i) => choices.options[i])
            .join(" · ");
    actions.draftReply({ messageId: message.id, thread: message.thread, text });
  }
</script>

<!-- The options are real buttons in every state: yours to pick (they fill the reply box), the one picked (filled,
     ✓), or someone else's question (disabled, with whose it is under them). -->
{#snippet option(label: string, on: boolean, disabled: boolean)}<span
    class={cn(
      buttonVariants({ variant: on ? "default" : "outline", size: "sm" }),
      "pointer-events-none h-auto min-h-8 whitespace-pre-wrap text-left",
      disabled && !on && "text-muted-foreground",
    )}
    >{#if on}<Icon icon={Check} size={14} />{/if}{label}</span
  >{/snippet}
<div data-native-choices class="space-y-2 font-sans text-sm text-foreground">
  {#if answer}<div class="flex flex-wrap gap-2">
      {#each choices.options as label}{@render option(
          label,
          picked.has(label),
          true,
        )}{/each}{#if !choices.options.some( (label) => picked.has(label) )}{@render option(
          vb.t("Outro"),
          true,
          true,
        )}{/if}
    </div>
  {:else if actionable}<div
      role={choices.multi ? "group" : "radiogroup"}
      aria-label={vb.t("Escolha uma opção")}
      class="flex flex-wrap gap-2"
    >
      {#each [...choices.options, vb.t("Outro") + "…"] as label, index}{@const value =
          index === choices.options.length ? -1 : index}{@const on =
          selected.includes(value)}<button
          type="button"
          role={choices.multi ? "checkbox" : "radio"}
          aria-checked={on}
          class={cn(
            buttonVariants({ variant: on ? "default" : "outline", size: "sm" }),
            "h-auto min-h-8 whitespace-pre-wrap text-left",
          )}
          onclick={() => choose(value, choices.multi ? !on : true)}
          >{#if on}<Icon icon={Check} size={14} />{/if}{label}</button
        >{/each}
    </div>
  {:else}<div class="flex flex-wrap gap-2" aria-disabled="true">
      {#each choices.options as label}{@render option(
          label,
          false,
          true,
        )}{/each}
    </div>
    <small class="block text-muted-foreground"
      >{choices.closed
        ? vb.t("foi pro terminal")
        : vb.t("esperando {who}", { who: vb.name(message.author) })}</small
    >{/if}
</div>
