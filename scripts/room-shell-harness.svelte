<script lang="ts">
  import RoomShell from "../web/features/room-shell/RoomShell.svelte";
  import type { ApplicationRoomPresentation } from "../web/features/application/shellTypes";
  import type { RoomResources } from "../web/features/application/roomResources";
  import type { RoomScopeBrowser } from "../web/features/room-scope/types";
  import type { RoomLayoutBrowser } from "../web/features/room-layout/types";
  let {
    presentation,
    resources,
    browser,
    layoutBrowser,
  }: {
    presentation: ApplicationRoomPresentation;
    resources: RoomResources;
    browser: RoomScopeBrowser;
    layoutBrowser: RoomLayoutBrowser;
  } = $props();
</script>

<RoomShell {presentation} {resources} {browser} {layoutBrowser} />
