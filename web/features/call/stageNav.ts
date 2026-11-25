/** The stage and the room's thread (RoomScene): opening the stage goes once to the call's own thread
 *  (room.callThread: a room's call has a thread of its own, a DM's call is the conversation), and any move to
 *  another thread (the sidebar, the room's name, a link, Back) closes the stage while the call goes on. Nothing here
 *  ever sends the person back to the call's thread after they left it: Gimenes, 2026-11-25, "não sai". */
export type StageMove = { close: true } | { go: string } | null;

export function createStageNav() {
  let last = "",
    heading = false,
    asked = "";
  return {
    /** The stage opened (a join, the panel, the green phone): go to the call's thread once. */
    opened() {
      heading = true;
      asked = "";
    },
    /** The stage closed: nothing more to go to. */
    closed() {
      heading = false;
    },
    /** What the stage does now. `thread`: the room's thread open now; `target`: the call's thread (missing while
     *  the room has not said it yet); `staged`: the stage is on show; `has`: the room has that thread now. */
    see(
      thread: string,
      target: string | undefined,
      staged: boolean,
      has: (thread: string) => boolean,
    ): StageMove {
      const moved = thread !== last;
      last = thread;
      if (!staged) return null;
      if (moved && thread !== target) {
        heading = false;
        return { close: true };
      }
      if (!heading || !target) return null;
      if (thread === target) {
        heading = false;
        return null;
      }
      if (asked === target || !has(target)) return null;
      asked = target;
      return { go: target };
    },
  };
}
