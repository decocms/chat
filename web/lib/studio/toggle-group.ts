import { getContext, setContext } from "svelte";
import type { ToggleVariants } from "./toggle";

const KEY = Symbol("studio-toggle-group");

/** The group's variant and size, read by each item. A getter keeps it reactive. */
export function setToggleGroupContext(read: () => ToggleVariants): void {
  setContext(KEY, read);
}

export function getToggleGroupContext(): ToggleVariants {
  return getContext<(() => ToggleVariants) | undefined>(KEY)?.() ?? {};
}
