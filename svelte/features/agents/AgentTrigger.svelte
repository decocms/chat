<script lang="ts">
  import { untrack } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import type { RoomAgentSession } from "./room";
  import { agentPresence } from "./model";
  import { runnerPath } from "./runner";
  import { roomAgentText } from "./roomCopy";
  let {
    owner,
    onopen,
    lang = "pt",
  }: { owner: RoomAgentSession; onopen(): void; lang?: "pt" | "en" } = $props();
  const view = untrack(() => owner.state),
    runner = untrack(() => owner.runner.state);
  const presence = $derived(
    agentPresence($view.data, owner.account, $view.now),
  );
  const path = $derived(runnerPath($runner.where));
  const text = (key: Parameters<typeof roomAgentText>[1]) =>
    roomAgentText(lang, key);
  const state = $derived(
    text(
      presence.on ? (presence.live ? "listening" : "notListening") : "turnOn",
    ),
  );
  const help = $derived(
    path
      ? `${path} (${text($runner.where?.how === "used" ? "usedFolder" : $runner.where?.how === "linked" ? "bound" : $runner.where?.how === "slug" ? "slug" : $runner.where?.how === "new" ? "newFolder" : "folder")})`
      : text("localHelp"),
  );
</script>

{#if $view.data}<Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}<Button
          {...props}
          data-native-agent-trigger
          variant="outline"
          aria-pressed={presence.on}
          aria-label={path ? `${state} · ${help}` : state}
          onclick={() => {
            if (owner.current()) onopen();
          }}
          ><span
            aria-hidden="true"
            class={presence.live
              ? "tw:text-success"
              : presence.on
                ? "tw:text-warning"
                : "tw:text-muted-foreground"}>✻</span
          ><span
            aria-hidden="true"
            class="tw:hidden tw:max-[900px]:inline tw:@min-[34rem]/room-header:inline"
            >{state}</span
          >{#if path}<span
              aria-hidden="true"
              class="tw:hidden tw:max-w-40 tw:truncate tw:text-xs tw:text-muted-foreground tw:max-[900px]:inline tw:@min-[50rem]/room-header:inline"
              >{path.replace(
                /^~\/Projects\//,
                "",
              )}{#if $runner.where?.how === "new"}
                +{/if}</span
            >{/if}</Button
        >{/snippet}
    </TooltipTrigger>
    <TooltipContent side="bottom" class="tw:max-w-72"
      >{state}<br />{help}</TooltipContent
    >
  </Tooltip>{/if}
