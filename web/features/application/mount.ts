import { mount, unmount } from "svelte";
import Application from "./Application.svelte";

import { applicationShellVersion } from "./version";
export { applicationShellVersion } from "./version";

/** The single Svelte root; domain views are composed inside the component. */
export function mountApplication(
  target: HTMLElement,
  doc: Document = document,
) {
  const instance = mount(Application, {
    target,
    props: { document: doc, shellVersion: applicationShellVersion(doc) },
  });
  let active = true;
  return {
    destroy() {
      if (!active) return;
      active = false;
      return unmount(instance);
    },
  };
}
