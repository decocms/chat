import { get, writable } from "svelte/store";
import type { Attachment, Room } from "../../../shared/room";
import type { RequestRoomCommand } from "../../roomConnection";
import type { FileViewer } from "./session";
import { fileVersions, FileTarget, knownViewerFiles } from "./model";
export type SideFileInput = Pick<
  Attachment,
  "id" | "name" | "type" | "size" | "ts"
>;
export type SideFileTarget = Readonly<{
  roomId: string;
  name: string;
  id: string;
  follow: boolean;
  witness: Readonly<SideFileInput>;
}>;
const fileWitness = (file: SideFileInput): Readonly<SideFileInput> =>
  Object.freeze({
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    ts: file.ts,
  });
/** One owned beside-chat selection. The viewer retains all byte/read/index safeguards. */
export function createSideFileSession(
  viewer: FileViewer,
  options: { current(): boolean; changed(): void },
) {
  let active = true,
    room: Room | null = null,
    revision = 0;
  const state = writable<SideFileTarget | null>(null);
  const current = () =>
    active && options.current() && !!room?.members.includes(room.me);
  function show(target: SideFileTarget) {
    if (!current() || !room || target.roomId !== room.id) return false;
    const metadata = knownViewerFiles(room).find(
      (file) => file.id === target.id && file.name === target.name,
    );
    return viewer.open({
      roomId: room.id,
      id: target.id,
      label: target.name,
      ...(metadata ? { metadata } : {}),
    });
  }
  function close() {
    const ticket = ++revision;
    state.set(null);
    if (!active || ticket !== revision) return;
    viewer.closeNavigation();
    if (ticket === revision) options.changed();
  }
  return {
    state,
    viewer,
    target: () => (current() ? get(state) : null),
    open(file: SideFileInput) {
      if (
        !current() ||
        !room ||
        !FileTarget.safeParse({ roomId: room.id, id: file.id }).success
      )
        return false;
      const known = knownViewerFiles(room).find((item) => item.id === file.id);
      if (
        known &&
        (known.name !== file.name ||
          known.type !== file.type ||
          known.size !== file.size ||
          known.ts !== file.ts)
      )
        return false;
      ++revision;
      const versions = fileVersions(room, file.name);
      const target = Object.freeze({
        witness: fileWitness(file),
        roomId: room.id,
        name: file.name,
        id: file.id,
        follow:
          !versions.length ||
          versions[0]?.id === file.id ||
          file.ts > versions[0]!.ts,
      });
      state.set(target);
      if (!current() || get(state) !== target) return false;
      const opened = show(target);
      options.changed();
      return opened;
    },
    sync(next: Room, request: RequestRoomCommand, fresh = false) {
      if (!active) return;
      if (room && (next.id !== room.id || next.me !== room.me)) {
        room = null;
        close();
        return;
      }
      const previousFile = get(viewer.state).file?.id;
      room = next;
      viewer.sync(next, request, fresh);
      if (!current()) {
        close();
        return;
      }
      const target = get(state);
      if (!target) return;
      const versions = fileVersions(next, target.name),
        latest = versions[0],
        knownIndex = versions.findIndex((file) => file.id === target.id);
      if (
        target.follow &&
        latest &&
        latest.id !== target.id &&
        (latest.ts > target.witness.ts ||
          (latest.ts === target.witness.ts && knownIndex > 0))
      ) {
        const updated = Object.freeze({
          ...target,
          id: latest.id,
          witness: fileWitness(latest),
        });
        state.set(updated);
        if (current() && get(state) === updated) show(updated);
      } else if (
        previousFile !== target.id &&
        knownViewerFiles(next).some(
          (file) => file.id === target.id && file.name === target.name,
        )
      )
        show(target);
    },
    select(expected: SideFileTarget, id: string) {
      if (!current() || !room || get(state) !== expected) return;
      const versions = fileVersions(room, expected.name),
        file = versions.find((file) => file.id === id);
      if (!file) return;
      ++revision;
      const target = Object.freeze({
        ...expected,
        id,
        follow: versions[0]?.id === id,
        witness: fileWitness(file),
      });
      state.set(target);
      if (current() && get(state) === target) show(target);
      options.changed();
    },
    close,
    dispose() {
      if (!active) return;
      active = false;
      room = null;
      viewer.dispose();
      state.set(null);
    },
  };
}
export type SideFileSession = ReturnType<typeof createSideFileSession>;
