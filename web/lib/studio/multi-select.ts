import type { IconNode } from "./icons";

/** `icon` is an icon from `./icons`, where React took a component. */
export interface Option {
  label: string;
  value: string;
  icon?: IconNode;
}
