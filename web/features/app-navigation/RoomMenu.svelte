<script lang="ts">
  import { get } from "svelte/store";
  import { onDestroy } from "svelte";
  import { TINTS } from "../../../shared/schemas";
  import DropdownMenu from "../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuContent from "../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuItem from "../../lib/studio/DropdownMenuItem.svelte";
  import DropdownMenuSeparator from "../../lib/studio/DropdownMenuSeparator.svelte";
  import DropdownMenuSub from "../../lib/studio/DropdownMenuSub.svelte";
  import DropdownMenuSubContent from "../../lib/studio/DropdownMenuSubContent.svelte";
  import DropdownMenuSubTrigger from "../../lib/studio/DropdownMenuSubTrigger.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { cn } from "../../lib/studio/utils";
  import { createApplicationCopy } from "../application/copy";
  import { copyChatText } from "../chat/clipboard";
  import type { RoomTint } from "../home/api";
  import { homeIssue, type HomeLanguage } from "../home/copy";
  import {
    dmEntry,
    orderedRooms,
    roomsOnly,
    targetHref,
    unread,
  } from "../home/model";
  import { roomIconPng } from "../rooms/images";
  import type { AppNavigationSession } from "./controller";
  /**
   * A room's menu (like Discord's server menu): a right-click, a long press or
   * Shift+F10 on a room in the rail, the phone's grid and list, or a DM row
   * opens it at the pointer (controller.openMenu). One menu for the whole
   * app; it is the only place to change a room's color, icon and order by hand.
   * A DM gets the items that apply to it: mark as read and copy its link.
   */
  let {
    controller,
    lang,
  }: {
    controller: AppNavigationSession;
    lang: HomeLanguage;
  } = $props();
  const personal = $derived(controller.personal.state),
    nav = $derived(controller.state),
    mutations = $derived(controller.rooms.state);
  const t = $derived(createApplicationCopy(lang));
  const anchor = $derived($nav.menu);
  const room = $derived(
    anchor ? $personal.me?.books.find((room) => room.id === anchor.id) : null,
  );
  const rail = $derived(
    orderedRooms(roomsOnly($personal.me?.books ?? [])).map((room) => room.id),
  );
  const title = $derived(
    room
      ? room.dm
        ? (dmEntry($personal.me, room.id)?.name ?? "")
        : (room.title ?? "deco.chat")
      : "",
  );
  // The menu opens at the pointer: a zero-size box there is its anchor.
  const point = $derived(
    anchor
      ? {
          getBoundingClientRect: (): DOMRect => {
            const { x, y } = anchor,
              box = { x, y, width: 0, height: 0 };
            return {
              ...box,
              top: y,
              left: x,
              right: x,
              bottom: y,
              toJSON: () => box,
            };
          },
        }
      : null,
  );
  const tintLabel = (tint: RoomTint) => {
    switch (tint) {
      case null:
        return t("Sem cor");
      case "blue":
        return t("Azul");
      case "green":
        return t("Verde");
      case "yellow":
        return t("Amarelo");
      case "orange":
        return t("Laranja");
      case "pink":
        return t("Rosa");
      case "purple":
        return t("Roxo");
      default: {
        const unknown: never = tint;
        return unknown;
      }
    }
  };
  const tintDot = (tint: RoomTint) => {
    switch (tint) {
      case null:
        return "border border-border bg-background";
      case "blue":
        return "bg-room-tint-blue";
      case "green":
        return "bg-room-tint-green";
      case "yellow":
        return "bg-room-tint-yellow";
      case "orange":
        return "bg-room-tint-orange";
      case "pink":
        return "bg-room-tint-pink";
      case "purple":
        return "bg-room-tint-purple";
      default: {
        const unknown: never = tint;
        return unknown;
      }
    }
  };
  // What an item did, said briefly at the screen's foot: "Copied", or why a change didn't go through.
  let notice = $state(""),
    noticeTimer: ReturnType<typeof setTimeout> | undefined,
    watching = $state<string | null>(null);
  function say(text: string) {
    clearTimeout(noticeTimer);
    notice = text;
    noticeTimer = setTimeout(() => (notice = ""), 2500);
  }
  $effect(() => {
    const issue = watching ? $mutations.issues[watching] : undefined;
    if (!issue) return;
    watching = null;
    say(homeIssue(lang, issue));
  });
  onDestroy(() => clearTimeout(noticeTimer));
  let iconInput = $state<HTMLInputElement | null>(null),
    iconRoom: string | null = null,
    iconSequence = 0;
  async function upload(file: File) {
    const id = iconRoom,
      ticket = ++iconSequence,
      identity = get(controller.personal.state).identityRevision;
    if (!id) return;
    try {
      const image = await roomIconPng(file);
      if (
        ticket === iconSequence &&
        identity === get(controller.personal.state).identityRevision
      ) {
        watching = `icon:${id}`;
        await controller.rooms.icon(id, image);
      }
    } catch (error) {
      if (ticket === iconSequence)
        say(
          homeIssue(lang, error instanceof Error ? error.message : "network"),
        );
    }
  }
  async function copyLink(id: string) {
    try {
      await copyChatText(
        new URL(targetHref({ roomId: id }), location.href).href,
      );
      say(t("Copiado"));
    } catch {
      say(t("Não consegui copiar o link."));
    }
  }
  const itemClass = "gap-2";
</script>

<input
  bind:this={iconInput}
  type="file"
  accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,.ico"
  class="hidden"
  tabindex="-1"
  aria-hidden="true"
  data-room-menu-icon
  onchange={(event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void upload(file);
  }}
/>
{#key anchor}{#if room && point}{@const id = room.id}
    {@const position = rail.indexOf(id)}
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) controller.closeMenu();
      }}
    >
      <DropdownMenuContent
        customAnchor={point}
        side="bottom"
        align="start"
        sideOffset={2}
        data-room-menu={id}
        aria-label={t("Ações de {name}", { name: title })}
        class="w-56"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // A dialog the menu opened (archive, rename) takes the focus itself.
          const s = get(controller.state);
          if (s.archiveId || s.renameId) return;
          controller.returnFocus(null)?.focus({ preventScroll: true });
        }}
      >
        <DropdownMenuItem
          class={itemClass}
          disabled={!unread(room, $personal.seen[id] ?? 0)}
          onSelect={() => {
            watching = `read:${id}`;
            controller.markRead(id);
          }}
          ><Icon icon="check-circle" />{t("Marcar como lido")}</DropdownMenuItem
        >
        {#if !room.dm}<DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger class={itemClass}
              ><Icon icon="palette" />{t("Cor")}</DropdownMenuSubTrigger
            >
            <DropdownMenuSubContent class="w-44" data-room-menu-tints>
              {#each [null, ...TINTS] as tint (tint ?? "none")}<DropdownMenuItem
                  class={itemClass}
                  data-tint={tint ?? "none"}
                  disabled={!!$mutations.pending[`tint:${id}`]}
                  onSelect={() => {
                    watching = `tint:${id}`;
                    void controller.rooms.tint(id, tint);
                  }}
                  ><span
                    aria-hidden="true"
                    class={cn("size-3 shrink-0 rounded-full", tintDot(tint))}
                  ></span>{tintLabel(
                    tint,
                  )}{#if (room.tint ?? null) === tint}<Icon
                      icon="check"
                      class="ml-auto text-foreground"
                    /><span class="sr-only">{t("(atual)")}</span
                    >{/if}</DropdownMenuItem
                >{/each}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger class={itemClass}
              ><Icon icon="image-01" />{t("Ícone")}</DropdownMenuSubTrigger
            >
            <DropdownMenuSubContent class="w-44">
              <DropdownMenuItem
                class={itemClass}
                disabled={!!$mutations.pending[`icon:${id}`]}
                onSelect={() => {
                  iconRoom = id;
                  iconInput?.click();
                }}
                ><Icon icon="upload-01" />{t("Trocar ícone…")}</DropdownMenuItem
              >
              {#if room.icon}<DropdownMenuItem
                  class={itemClass}
                  disabled={!!$mutations.pending[`icon:${id}`]}
                  onSelect={() => {
                    watching = `icon:${id}`;
                    void controller.rooms.icon(id, null);
                  }}
                  ><Icon icon="trash-01" />{t(
                    "Remover ícone",
                  )}</DropdownMenuItem
                >{/if}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {#if $nav.roomId === id && controller.callbacks.rename}<DropdownMenuItem
              class={itemClass}
              onSelect={() => controller.askRename(id)}
              ><Icon icon="pencil-01" />{t("Renomear sala")}</DropdownMenuItem
            >{/if}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger class={itemClass}
              ><Icon icon="switch-vertical-01" />{t(
                "Mover",
              )}</DropdownMenuSubTrigger
            >
            <DropdownMenuSubContent class="w-44">
              <DropdownMenuItem
                class={itemClass}
                disabled={position <= 0 || !!$mutations.pending.order}
                onSelect={() => {
                  watching = "order";
                  controller.move(id, -1);
                }}><Icon icon="arrow-up" />{t("Para cima")}</DropdownMenuItem
              >
              <DropdownMenuItem
                class={itemClass}
                disabled={position < 0 ||
                  position >= rail.length - 1 ||
                  !!$mutations.pending.order}
                onSelect={() => {
                  watching = "order";
                  controller.move(id, 1);
                }}><Icon icon="arrow-down" />{t("Para baixo")}</DropdownMenuItem
              >
            </DropdownMenuSubContent>
          </DropdownMenuSub>{/if}
        <DropdownMenuSeparator />
        <DropdownMenuItem class={itemClass} onSelect={() => void copyLink(id)}
          ><Icon icon="link-01" />{t(
            room.dm ? "Copiar link da conversa" : "Copiar link da sala",
          )}</DropdownMenuItem
        >
        {#if !room.dm}<DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            class={cn(
              itemClass,
              "data-[variant=destructive]:focus:bg-destructive data-[variant=destructive]:focus:text-destructive-foreground dark:data-[variant=destructive]:focus:bg-destructive data-[variant=destructive]:focus:*:[svg]:!text-destructive-foreground",
            )}
            onSelect={() => controller.askArchive(id)}
            ><Icon icon="archive" />{t("Arquivar")}</DropdownMenuItem
          >{/if}
      </DropdownMenuContent>
    </DropdownMenu>
  {/if}{/key}
{#if notice}<p
    role="status"
    data-room-menu-notice
    class="fixed bottom-4 left-1/2 z-50 m-0 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 font-sans text-sm text-background shadow-lg"
  >
    {notice}
  </p>{/if}
