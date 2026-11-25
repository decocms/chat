import { mount, unmount } from "svelte";
import Gallery from "./Gallery.svelte";
import RoomLayoutFixture from "./RoomLayoutFixture.svelte";
import CallFixture from "./CallFixture.svelte";

export function mountGallery(target: Element) {
  const probe = new URLSearchParams(location.search).get("probe");
  const instance = mount(
    probe === "room-layout"
      ? RoomLayoutFixture
      : probe === "call"
        ? CallFixture
        : Gallery,
    { target },
  );
  return () => unmount(instance);
}
