// Test-only component adapter. The application composes features directly.
import { flushSync, mount, unmount } from "svelte";
import type { Component, ComponentProps } from "svelte";
import { writable } from "svelte/store";
import View from "./UiPanelView.svelte";
import Tasks from "../web/features/tasks/Tasks.svelte";
import Files from "../web/features/files/Files.svelte";
import Reminders from "../web/features/reminders/Reminders.svelte";
import Decisions from "../web/features/decisions/Decisions.svelte";
import Sidebar from "../web/features/room-sidebar/Sidebar.svelte";
import Chat from "../web/features/chat/Chat.svelte";
import Composer from "../web/features/composer/Composer.svelte";
import DocumentPanel from "../web/features/documents/DocumentPanel.svelte";
import AppsPanel from "../web/features/apps/AppsPanel.svelte";
import AgentSettings from "../web/features/agents/AgentSettings.svelte";
import SuggestionPreview from "../web/features/room-sidebar/SuggestionPreview.svelte";
import RoomBarTitle from "../web/features/room-shell/RoomBarTitle.svelte";
export { dismissDialogs } from "../web/lib/studio/dialogController";
const fixtures = {
  tasks: Tasks,
  files: Files,
  reminders: Reminders,
  decisions: Decisions,
  sidebar: Sidebar,
  chat: Chat,
  composer: Composer,
  document: DocumentPanel,
  apps: AppsPanel,
  agentSettings: AgentSettings,
  suggestionPreview: SuggestionPreview,
  roomBarTitle: RoomBarTitle,
};
type FixtureName = keyof typeof fixtures;
/** Preserve the existing checked test call-site relation and flush/update/cleanup
 * behavior. The pre-existing erased forwarding boundary is confined to tests. */
export function mountView<K extends FixtureName>(
  kind: K,
  target: Element,
  props: ComponentProps<(typeof fixtures)[K]>,
) {
  const values = writable<Record<string, unknown>>(props);
  const component = fixtures[kind] as unknown as Component<
    Record<string, unknown>
  >;
  const instance = flushSync(() =>
    mount(View, { target, props: { component, values } }),
  );
  return {
    update(next: ComponentProps<(typeof fixtures)[K]>) {
      flushSync(() => values.set(next));
    },
    destroy() {
      flushSync(() => {
        void unmount(instance);
      });
    },
  };
}
