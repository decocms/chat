<script lang="ts">
  import TitledDialog from "../../lib/components/TitledDialog.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import RailButton from "./RailButton.svelte";
  import { createApplicationCopy } from "../application/copy";
  import { homeText, type HomeLanguage } from "../home/copy";
  import type { OrgDirectoryRoom } from "../../../shared/schemas";
  import type { AppNavigationSession } from "./controller";
  /**
   * "Salas da empresa": a rail button (2×2 grid) that opens every room open to
   * your company email domain (src/orgRooms.ts orgDirectory). A room you are
   * not in has Entrar (in at once, then it opens); one you are in says "Você
   * está aqui". Read fresh each time it opens, never cached.
   */
  let {
    controller,
    lang,
  }: { controller: AppNavigationSession; lang: HomeLanguage } = $props();
  const t = $derived(createApplicationCopy(lang));
  type View =
    | { phase: "loading" }
    | { phase: "failed" }
    | { phase: "ready"; rooms: readonly OrgDirectoryRoom[] };
  let open = $state(false),
    view = $state<View>({ phase: "loading" }),
    busy = $state<string | null>(null),
    failed = $state<string | null>(null),
    trigger = $state<HTMLButtonElement | null>(null),
    load: AbortController | null = null;
  function read() {
    const fetch = controller.callbacks.orgDirectory;
    load?.abort();
    if (!fetch) return void (view = { phase: "ready", rooms: [] });
    const abort = (load = new AbortController());
    view = { phase: "loading" };
    fetch(abort.signal).then(
      (result) => {
        if (load === abort) view = { phase: "ready", rooms: result.rooms };
      },
      () => {
        if (load === abort) view = { phase: "failed" };
      },
    );
  }
  function show() {
    failed = null;
    open = true;
    read();
  }
  function closed() {
    load?.abort();
    load = null;
  }
  async function join(room: string) {
    if (busy) return;
    busy = room;
    failed = null;
    try {
      // Joins, leaves the home's "Da sua empresa" and opens the room (services.ts joinOrg).
      await controller.joinCompany(room);
      open = false;
      closed();
    } catch {
      failed = room;
    } finally {
      busy = null;
    }
  }
  const people = (n: number) =>
    n === 1 ? t("1 pessoa") : t("{n} pessoas", { n });
  const iconOf = (room: OrgDirectoryRoom) =>
    room.member && room.icon != null
      ? `/api/books/${encodeURIComponent(room.id)}/icon?v=${room.icon}`
      : null;
</script>

<RailButton
  bind:ref={trigger}
  icon="grid-01"
  label={t("Salas da empresa")}
  data-company-rooms-button
  aria-haspopup="dialog"
  aria-expanded={open}
  onclick={(event) => {
    if (event.currentTarget.isConnected) show();
  }}
/>
<TitledDialog
  bind:open
  title={t("Salas da empresa")}
  closeLabel={t("Fechar")}
  onOpenChange={(next) => {
    if (!next) closed();
  }}
  returnFocus={() => trigger}
>
  <div data-company-rooms class="flex min-h-24 flex-col">
    {#if view.phase === "loading"}<p
        role="status"
        class="m-0 py-6 text-center text-muted-foreground"
      >
        {t("Carregando…")}
      </p>{:else if view.phase === "failed"}<div
        role="alert"
        class="flex flex-col items-center gap-3 py-6"
      >
        <p class="m-0 text-muted-foreground">
          {t("Não deu pra carregar as salas.")}
        </p>
        <Button variant="outline" size="sm" onclick={read}
          >{t("Tentar de novo")}</Button
        >
      </div>{:else if view.rooms.length === 0}<p
        data-company-rooms-empty
        class="m-0 py-6 text-center text-muted-foreground"
      >
        {t("Nenhuma sala aberta pra sua empresa ainda.")}
      </p>{:else}<ul class="m-0 flex list-none flex-col gap-0.5 p-0">
        {#each view.rooms as room (room.id)}<li
            data-company-room={room.id}
            class="flex min-h-12 min-w-0 items-center gap-3 rounded-lg px-2 py-1.5"
          >
            <RoomAvatar
              size="md"
              title={room.title}
              icon={iconOf(room)}
              {lang}
              surface="background"
            />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate font-medium">{room.title}</span>
              <span class="truncate text-xs leading-4 text-muted-foreground"
                >{people(room.people)}</span
              >
              {#if failed === room.id}<span
                  role="alert"
                  class="text-xs leading-4 text-destructive"
                  >{t("Não deu pra entrar. Tente de novo.")}</span
                >{/if}
            </span>
            {#if room.member}<span
                data-company-room-here
                class="shrink-0 text-xs text-muted-foreground"
                >{t("Você está aqui")}</span
              >{:else}<Button
                size="xs"
                class="shrink-0"
                disabled={!!busy}
                aria-busy={busy === room.id || undefined}
                onclick={() => join(room.id)}>{homeText(lang, "join")}</Button
              >{/if}
          </li>{/each}
      </ul>{/if}
  </div>
</TitledDialog>
