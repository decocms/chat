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
  import DropdownMenuSeparator from "../../lib/studio/DropdownMenuSeparator.svelte";
  import DropdownMenuTrigger from "../../lib/studio/DropdownMenuTrigger.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import { cn } from "../../lib/studio/utils";
  /**
   * The epic's status: a pill that opens the list of statuses (A fazer …
   * Arquivado). "Feito" and "Arquivado" archive the epic, an open status
   * reopens it (Book.setEpicStatus). `bar`: at the end of the desktop top
   * bar's title, then a vertical line before the pane's tabs. `sheet`: under
   * the title in the phone's thread sheet. `pinnable`: the menu also pins the
   * epic, since the epic list has no actions menu (Gimenes #3924, #3933). It
   * does not pick the owner (Gimenes #3975).
   */
  let {
    epic,
    owner,
    t,
    variant,
    pinnable = false,
  }: {
    epic: Epic;
    owner: RoomMutations;
    t: (text: string, vars?: Record<string, string | number>) => string;
    variant: "bar" | "sheet";
    pinnable?: boolean;
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
      {#if pinnable && !epic.archived}<DropdownMenuSeparator />
        <DropdownMenuItem
          data-epic-pin={epic.id}
          disabled={busy}
          onSelect={() =>
            void owner.run({
              t: "epic.pin",
              id: epic.id,
              pinned: !epic.pinned,
            })}
          ><Icon icon="pin-02" />{t(
            epic.pinned ? "Desafixar" : "Fixar no topo",
          )}</DropdownMenuItem
        >{/if}
    </DropdownMenuContent>
  </DropdownMenu>{/snippet}

{#if variant === "bar"}<!-- Right after the epic's title (Gimenes #3975). -->
  <span data-epic-bar-actions class="flex shrink-0 items-center gap-1">
    {@render pill()}
  </span>{:else}<div data-epic-sheet-status class="flex px-2 pb-1">
    {@render pill()}
  </div>{/if}
