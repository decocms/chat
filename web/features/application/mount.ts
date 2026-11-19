import { mount, unmount } from "svelte";
import Application from "./Application.svelte";

import { applicationShellVersion } from "./version";
import { reloadForNewBuild } from "../deferred-view/staleBuild";
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
  // Any lazy chunk (not only createDeferredModule's) from an older deploy: Vite reports it here. Reload once
  // (staleBuild); preventDefault keeps Vite from throwing while the page goes away.
  const view = doc.defaultView;
  const onPreloadError = (event: Event) => {
    if (reloadForNewBuild()) event.preventDefault();
  };
  view?.addEventListener("vite:preloadError", onPreloadError);
  let active = true;
  return {
    destroy() {
      if (!active) return;
      active = false;
      view?.removeEventListener("vite:preloadError", onPreloadError);
      return unmount(instance);
    },
  };
}
