<script lang="ts">
  import { untrack } from "svelte";
  import type { Epic, EpicStatus } from "../../../shared/room";
  import { epicStatus, epicStatusChoices, epicStatusLook } from "./model";
  import type { RoomMutations } from "./session";
  import { studioType } from "../../lib/components/type";
  import DropdownMenu from "../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuContent from "../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuItem from "../../lib/studio/DropdownMenuItem.svelte";
  import DropdownMenuLabel from "../../lib/studio/DropdownMenuLabel.svelte";
  import DropdownMenuTrigger from "../../lib/studio/DropdownMenuTrigger.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import Separator from "../../lib/studio/Separator.svelte";
  import { cn } from "../../lib/studio/utils";
  /**
   * The epic's status: a pill that opens the list of statuses (A fazer …
   * Arquivado). "Feito" and "Arquivado" archive the epic, an open status
   * reopens it (Book.setEpicStatus). `bar`: at the end of the desktop top
   * bar's title, then a vertical line before the pane's tabs. `sheet`: under
   * the title in the phone's thread sheet.
   */
  let {
    epic,
    owner,
    t,
    variant,
  }: {
    epic: Epic;
    owner: RoomMutations;
    t: (text: string, vars?: Record<string, string | number>) => string;
    variant: "bar" | "sheet";
  } = $props();
  const mutation = untrack(() => owner.state);
  const busy = $derived(
    $mutation.phase === "pending" || $mutation.phase === "unconfirmed",
  );
  const current = $derived(epicStatus(epic));
  const look = $derived(epicStatusLook(current));
  function choose(status: EpicStatus) {
    if (busy || status === epic.status) return;
    void owner.run({ t: "epic.status", id: epic.id, status });
  }
</script>

{#snippet pill()}<DropdownMenu>
    <DropdownMenuTrigger
      data-epic-status={current}
      disabled={busy}
      aria-label={`${t("Status")}: ${t(look.label)}`}
      class={cn(
        buttonVariants({ variant: "ghost", size: "xs" }),
        "rounded-full font-semibold",
        look.pill,
      )}
      ><Icon icon={look.icon} class="size-3.5" />{t(look.label)}<Icon
        icon="chevron-down"
        class="size-3.5 opacity-70"
      /></DropdownMenuTrigger
    >
    <DropdownMenuContent
      align={variant === "bar" ? "end" : "start"}
      class={cn(studioType, "w-52")}
    >
      <DropdownMenuLabel class="text-xs text-muted-foreground"
        >{t("Status")}</DropdownMenuLabel
      >
      {#each epicStatusChoices as choice (choice.value)}<DropdownMenuItem
          data-epic-status-choice={choice.value}
          disabled={busy}
          class={cn(choice.value === current && "font-semibold")}
          onSelect={() => choose(choice.value)}
          ><Icon icon={choice.icon} class={choice.text} />{t(
            choice.label,
          )}{#if choice.value === current}<Icon
              icon="check"
              class="ml-auto text-foreground"
            />{/if}</DropdownMenuItem
        >{/each}
    </DropdownMenuContent>
  </DropdownMenu>{/snippet}

{#if variant === "bar"}<span
    data-epic-bar-actions
    class="ml-auto flex shrink-0 items-center gap-1"
  >
    {@render pill()}
    <!-- The epic's own control ends here; the pane's tabs (Doc, Files…) follow. -->
    <Separator
      orientation="vertical"
      class="ml-1 data-[orientation=vertical]:h-5"
    />
  </span>{:else}<div data-epic-sheet-status class="flex px-2 pb-1">
    {@render pill()}
  </div>{/if}
