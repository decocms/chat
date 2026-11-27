<script lang="ts">
  import { get } from "svelte/store";
  import { onDestroy } from "svelte";
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
  import { homeIssue, type HomeLanguage } from "../home/copy";
  import { dmEntry, targetHref, unread } from "../home/model";
  import { knownTint, tintText } from "./tints";
  import type { AppNavigationSession } from "./controller";
  /**
   * A room's menu (like Discord's server menu): a right-click, a long press or
   * Shift+F10 on a room in the rail, the phone's grid and list, or a DM row
   * opens it at the pointer (controller.openMenu). One menu for the whole
   * app; "Editar sala…" opens the dialog with the name, icon and color (Gimenes #6163).
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
  const folders = $derived($personal.me?.folders ?? []);
  const moving = $derived(!!$mutations.pending.rail);
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
  // Archive and Leave: a solid red row under the pointer or the keyboard.
  const destructiveFocus =
    "data-[variant=destructive]:focus:bg-destructive data-[variant=destructive]:focus:text-destructive-foreground dark:data-[variant=destructive]:focus:bg-destructive data-[variant=destructive]:focus:*:[svg]:!text-destructive-foreground";
</script>

{#key anchor}{#if room && point}{@const id = room.id}
    {@const inFolder = room.dm ? null : controller.folderOf(id)}
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
          // A dialog the menu opened (archive, leave, rename) takes the focus itself.
          const s = get(controller.state);
          if (s.archiveId || s.leaveId || s.renameId) return;
          controller.returnFocus(null)?.focus({ preventScroll: true });
        }}
      >
        <DropdownMenuItem
          class={itemClass}
          disabled={!unread(room, $personal.seen[id] ?? 0) &&
            !$personal.me?.waits.some((wait) => wait.book_id === id)}
          onSelect={() => {
            watching = `read:${id}`;
            controller.markRead(id);
          }}
          ><Icon icon="check-circle" />{t("Marcar como lido")}</DropdownMenuItem
        >
        {#if !room.dm}<DropdownMenuSeparator />
          {#if controller.callbacks.rename}<DropdownMenuItem
              class={itemClass}
              data-room-menu-edit
              onSelect={() => controller.askRename(id)}
              ><Icon icon="pencil-01" />{t("Editar sala…")}</DropdownMenuItem
            >{/if}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger class={itemClass}
              ><Icon icon="switch-vertical-01" />{t(
                "Mover",
              )}</DropdownMenuSubTrigger
            >
            <DropdownMenuSubContent class="w-52" data-room-menu-move>
              <DropdownMenuItem
                class={itemClass}
                disabled={!controller.canMove(id, -1) || moving}
                onSelect={() => {
                  watching = "rail";
                  controller.move(id, -1);
                }}><Icon icon="arrow-up" />{t("Para cima")}</DropdownMenuItem
              >
              <DropdownMenuItem
                class={itemClass}
                disabled={!controller.canMove(id, 1) || moving}
                onSelect={() => {
                  watching = "rail";
                  controller.move(id, 1);
                }}><Icon icon="arrow-down" />{t("Para baixo")}</DropdownMenuItem
              >
              <DropdownMenuSeparator />
              {#each folders as folder (folder.id)}{#if folder.id !== inFolder}<DropdownMenuItem
                    class={itemClass}
                    disabled={moving}
                    data-room-menu-folder={folder.id}
                    onSelect={() => {
                      watching = "rail";
                      controller.moveToFolder(id, folder.id);
                    }}
                    ><Icon
                      icon="folder"
                      class={tintText(knownTint(folder.tint))}
                    /><span class="truncate">{folder.name || t("Pasta")}</span
                    ></DropdownMenuItem
                  >{/if}{/each}
              <DropdownMenuItem
                class={itemClass}
                disabled={moving}
                data-room-menu-new-folder
                onSelect={() => {
                  watching = "rail";
                  controller.newFolder(id);
                }}
                ><Icon icon="folder-plus" />{t("Nova pasta")}</DropdownMenuItem
              >
              {#if inFolder}<DropdownMenuItem
                  class={itemClass}
                  disabled={moving}
                  data-room-menu-take-out
                  onSelect={() => {
                    watching = "rail";
                    controller.takeOut(id);
                  }}
                  ><Icon icon="log-out-01" />{t(
                    "Tirar da pasta",
                  )}</DropdownMenuItem
                >{/if}
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
            class={cn(itemClass, destructiveFocus)}
            onSelect={() => controller.askArchive(id)}
            ><Icon icon="archive" />{t("Arquivar")}</DropdownMenuItem
          >{#if room.owner && room.owner !== $personal.me?.email}<DropdownMenuItem
              variant="destructive"
              class={cn(itemClass, destructiveFocus)}
              data-room-menu-leave
              onSelect={() => controller.askLeave(id)}
              ><Icon icon="log-out-01" />{t("Sair da sala")}</DropdownMenuItem
            >{/if}{/if}
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
