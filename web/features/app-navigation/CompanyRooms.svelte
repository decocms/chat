<script lang="ts">
  import TitledDialog from "../../lib/components/TitledDialog.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import RailButton from "./RailButton.svelte";
  import { homeText, type HomeLanguage } from "../home/copy";
  import type { OrgRoom } from "../../../shared/schemas";
  /**
   * "Salas da empresa": a 2×2 grid button that opens the rooms open to your
   * company email domain that you did not join (GET /api/org/rooms), each with
   * who opened it and Entrar (joins and opens it). They stay out of the room
   * list, so it only holds the rooms you are in. On the rail (desktop) it sits
   * right above search; on a phone's list of conversations, in its bar, above
   * the search field.
   */
  let {
    rooms,
    lang,
    phone = false,
    onjoin,
    onopen,
  }: {
    rooms: readonly OrgRoom[];
    lang: HomeLanguage;
    /** The phone bar's round button instead of the rail's. */
    phone?: boolean;
    /** Joins a room open to your company and opens it. */
    onjoin?: (room: string) => Promise<void>;
    /** Called each time the dialog opens: reads the list again. */
    onopen?: () => void;
  } = $props();
  let open = $state(false),
    busy = $state<string | null>(null),
    failed = $state<string | null>(null),
    trigger = $state<HTMLElement | null>(null);
  const label = $derived(homeText(lang, "companyRooms"));
  function show(button: HTMLElement) {
    if (!button.isConnected) return;
    trigger = button;
    failed = null;
    open = true;
    onopen?.();
  }
  async function join(room: string) {
    if (busy || !onjoin) return;
    busy = room;
    failed = null;
    try {
      await onjoin(room);
      open = false;
    } catch {
      failed = room;
    } finally {
      busy = null;
    }
  }
</script>

{#if phone}<Button
    variant="secondary"
    data-company-rooms-button
    aria-label={label}
    aria-haspopup="dialog"
    aria-expanded={open}
    class="size-10 shrink-0 rounded-full p-0"
    onclick={(event) => show(event.currentTarget)}
    ><Icon icon="grid-01" class="size-5" /></Button
  >{:else}<RailButton
    icon="grid-01"
    {label}
    data-company-rooms-button
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={(event) => show(event.currentTarget)}
  />{/if}
<TitledDialog
  bind:open
  title={label}
  closeLabel={homeText(lang, "close")}
  returnFocus={() => trigger}
>
  <div data-company-rooms class="flex min-h-24 flex-col">
    {#if rooms.length === 0}<p
        data-company-rooms-empty
        class="m-0 py-6 text-center text-sm text-muted-foreground"
      >
        {homeText(lang, "companyRoomsEmpty")}
      </p>{:else}<ul
        class="m-0 -mx-2 flex max-h-[60dvh] list-none flex-col gap-0.5 overflow-y-auto p-0"
      >
        {#each rooms as room (room.id)}{@const who =
            room.opened_by_name || room.opened_by || ""}
          <li
            data-company-room={room.id}
            class="flex min-h-12 min-w-0 items-center gap-3 rounded-lg px-2 py-1.5"
          >
            <RoomAvatar
              size="md"
              title={room.title}
              {lang}
              surface="background"
            />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-medium">{room.title}</span>
              <span class="truncate text-xs leading-4 text-muted-foreground"
                >{homeText(
                  lang,
                  room.people === 1 ? "openedByOne" : "openedBy",
                  { who, n: room.people },
                )}</span
              >
              {#if failed === room.id}<span
                  role="alert"
                  class="text-xs leading-4 text-destructive"
                  >{homeText(lang, "requestFailed")}</span
                >{/if}
            </span>
            <Button
              size="xs"
              class="shrink-0"
              disabled={!!busy || !onjoin}
              aria-busy={busy === room.id || undefined}
              onclick={() => join(room.id)}>{homeText(lang, "join")}</Button
            >
          </li>{/each}
      </ul>{/if}
  </div>
</TitledDialog>
