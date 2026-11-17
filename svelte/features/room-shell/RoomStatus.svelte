<script lang="ts">
  import { untrack } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import ErrorState from "../../lib/components/ErrorState.svelte";
  import RoomSkeleton from "./RoomSkeleton.svelte";
  import type { RootRoomSnapshot } from "../root-room/session";
  import type { BrowserApplicationServices } from "../application/browser";
  let {
    snapshot,
    services,
  }: { snapshot: RootRoomSnapshot; services: BrowserApplicationServices } =
    $props();
  const application = untrack(() => services.state);
  // Before the socket opens the snapshot has no room yet: the URL names it.
  const roomId = $derived(
    snapshot.roomId ??
      ($application.route.kind === "room"
        ? $application.route.target.roomId
        : null),
  );
  const thread = $derived(
    ($application.route.kind === "room"
      ? $application.route.target.thread
      : undefined) ?? "main",
  );
  const current = (event: Event) =>
    services.active() &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected &&
    event.currentTarget
      .closest("[data-native-room-status]")
      ?.getAttribute("data-room-generation") ===
      String(services.rootRoom.read().generation);
  const home = (event: MouseEvent) => {
    if (current(event)) services.actions.home();
  };
</script>

{#if snapshot.phase === "removed" || snapshot.phase === "unavailable"}<main
    data-vb-native
    data-native-room-status={snapshot.phase}
    data-room-generation={snapshot.generation}
    class="tw:mx-auto tw:flex tw:min-h-[50dvh] tw:w-full tw:max-w-xl tw:flex-col tw:justify-center tw:gap-4 tw:p-6 tw:font-sans tw:text-sm tw:leading-6 tw:text-foreground"
  >
    <ErrorState
      title={services.t(
        snapshot.phase === "removed"
          ? "Você foi removido deste vibebook."
          : "Sem acesso a este vibebook. Peça para alguém de dentro te convidar.",
      )}
    />
    {#if snapshot.phase === "unavailable"}<Button
        variant="outline"
        onclick={(event) => {
          if (current(event)) services.actions.retryRoom();
        }}>{services.t("Verificar acesso novamente")}</Button
      >{/if}
    <Button variant="ghost" onclick={home}
      >{services.t("seus vibebooks")}</Button
    >
  </main>{:else}<div
    data-native-room-status={snapshot.phase}
    data-room-generation={snapshot.generation}
    class="tw:contents"
  >
    <RoomSkeleton {roomId} {thread} {services} onhome={home} />
  </div>{/if}
