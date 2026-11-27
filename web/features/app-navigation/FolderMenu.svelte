<script lang="ts">
  import { get } from "svelte/store";
  import DropdownMenu from "../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuContent from "../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuItem from "../../lib/studio/DropdownMenuItem.svelte";
  import DropdownMenuSeparator from "../../lib/studio/DropdownMenuSeparator.svelte";
  import DropdownMenuSub from "../../lib/studio/DropdownMenuSub.svelte";
  import DropdownMenuSubContent from "../../lib/studio/DropdownMenuSubContent.svelte";
  import DropdownMenuSubTrigger from "../../lib/studio/DropdownMenuSubTrigger.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { createApplicationCopy } from "../application/copy";
  import type { HomeLanguage } from "../home/copy";
  import { unread } from "../home/model";
  import type { AppNavigationSession } from "./controller";
  /**
   * A folder's menu on the rail (like Discord's): a right-click, a long press
   * or Shift+F10 on the folder opens it at the pointer. Mark all its rooms as
   * read, its settings (name and color), move it, and close every folder.
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
    mutations = $derived(controller.rooms.state),
    openFolders = $derived(controller.openFolders);
  const t = $derived(createApplicationCopy(lang));
  const anchor = $derived($nav.folderMenu);
  const folder = $derived(
    anchor
      ? $personal.me?.folders?.find((folder) => folder.id === anchor.id)
      : null,
  );
  const rooms = $derived(
    folder
      ? ($personal.me?.books ?? []).filter(
          (room) => room.rail_folder === folder.id,
        )
      : [],
  );
  const news = $derived(
    rooms.some(
      (room) =>
        unread(room, $personal.seen[room.id] ?? 0) ||
        $personal.me?.waits.some((wait) => wait.book_id === room.id),
    ),
  );
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
  $effect(() => {
    if ($nav.folderMenu && !folder) controller.closeFolderMenu();
  });
  const itemClass = "gap-2";
</script>

{#key anchor}{#if folder && point}{@const id = folder.id}
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) controller.closeFolderMenu();
      }}
    >
      <DropdownMenuContent
        customAnchor={point}
        side="bottom"
        align="start"
        sideOffset={2}
        data-folder-menu={id}
        aria-label={t("Ações de {name}", { name: folder.name || t("Pasta") })}
        class="w-56"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (get(controller.state).folderSettings) return;
          controller.returnFocus(null)?.focus({ preventScroll: true });
        }}
      >
        <DropdownMenuItem
          class={itemClass}
          disabled={!news}
          onSelect={() => controller.markFolderRead(id)}
          ><Icon icon="check-circle" />{t(
            "Marcar pasta como lida",
          )}</DropdownMenuItem
        >
        <DropdownMenuSeparator />
        <DropdownMenuItem
          class={itemClass}
          data-folder-menu-settings
          onSelect={() => controller.askFolderSettings(id)}
          ><Icon icon="settings-01" />{t(
            "Configurações da pasta…",
          )}</DropdownMenuItem
        >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger class={itemClass}
            ><Icon icon="switch-vertical-01" />{t(
              "Mover",
            )}</DropdownMenuSubTrigger
          >
          <DropdownMenuSubContent class="w-44">
            <DropdownMenuItem
              class={itemClass}
              disabled={!controller.canMove(id, -1) ||
                !!$mutations.pending.rail}
              onSelect={() => controller.move(id, -1)}
              ><Icon icon="arrow-up" />{t("Para cima")}</DropdownMenuItem
            >
            <DropdownMenuItem
              class={itemClass}
              disabled={!controller.canMove(id, 1) || !!$mutations.pending.rail}
              onSelect={() => controller.move(id, 1)}
              ><Icon icon="arrow-down" />{t("Para baixo")}</DropdownMenuItem
            >
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          class={itemClass}
          disabled={$openFolders.size === 0}
          data-folder-menu-close-all
          onSelect={() => controller.closeFolders()}
          ><Icon icon="minimize-01" />{t(
            "Fechar todas as pastas",
          )}</DropdownMenuItem
        >
      </DropdownMenuContent>
    </DropdownMenu>
  {/if}{/key}
