<script lang="ts">
  import type { Epic } from "../../../shared/room";
  import { studioType } from "../../lib/components/type";
  import DropdownMenu from "../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuContent from "../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuItem from "../../lib/studio/DropdownMenuItem.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { cn } from "../../lib/studio/utils";
  import type { MenuPoint } from "../app-navigation/roomMenuTrigger";
  /**
   * A thread row's menu in the sidebar (like the room's menu in the rail): a
   * right-click, a long press or Shift+F10 on the row opens it at the pointer,
   * or under the row from the keyboard. One menu for the whole list.
   */
  let {
    epic,
    point,
    busy,
    t,
    onclose,
    oncopy,
    onstatus,
  }: {
    epic: Epic;
    point: MenuPoint;
    busy: boolean;
    t: (text: string, vars?: Record<string, string | number>) => string;
    /** The menu closed (Escape, a click outside, or an item). */
    onclose: () => void;
    oncopy: () => void;
    onstatus: () => void;
  } = $props();
  // The menu opens at the pointer: a zero-size box there is its anchor.
  const anchor = $derived({
    getBoundingClientRect: (): DOMRect => {
      const { x, y } = point,
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
  });
  const itemClass = "gap-2";
</script>

<!-- No scroll lock (preventScroll): it turns off the pointer on the page, so the finger lifting after a long
     press in the phone's drawer lands on the drawer's backdrop and closes the drawer. -->

<DropdownMenu
  open
  onOpenChange={(open) => {
    if (!open) onclose();
  }}
>
  <DropdownMenuContent
    customAnchor={anchor}
    preventScroll={false}
    side="bottom"
    align="start"
    sideOffset={2}
    data-thread-menu={epic.id}
    aria-label={t("Ações de {name}", { name: epic.title })}
    class={cn(studioType, "w-56")}
    onCloseAutoFocus={(event) => event.preventDefault()}
  >
    <DropdownMenuItem class={itemClass} data-thread-menu-link onSelect={oncopy}
      ><Icon icon="link-01" />{t("Copiar link da thread")}</DropdownMenuItem
    >
    <DropdownMenuItem
      class={itemClass}
      data-thread-menu-status={epic.done ? "reopen" : "done"}
      disabled={busy}
      onSelect={onstatus}
      >{#if epic.done}<Icon icon="refresh-cw-01" />{t(
          "Reabrir thread",
        )}{:else}<Icon icon="check-circle" />{t(
          "Marcar como feita",
        )}{/if}</DropdownMenuItem
    >
  </DropdownMenuContent>
</DropdownMenu>
