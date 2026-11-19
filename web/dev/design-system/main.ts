import { mount, type Component } from "svelte";
import "../../styles";

/** Renders one Studio story by its Storybook id, so it can be compared with the React original. */
type Layout = "centered" | "padded" | "fullscreen";
type StoryModule = {
  default: Component<{ story: string }>;
  layouts?: Record<string, Layout>;
};

const modules = import.meta.glob<StoryModule>("./stories/*.svelte");
const parameters = new URLSearchParams(location.search);
const [component = "", story = ""] = (parameters.get("id") ?? "").split("--");
const root = document.getElementById("story-root");
if (!root) throw new Error("Missing story root");

document.documentElement.classList.toggle(
  "dark",
  parameters.get("theme") === "dark",
);

const load = modules[`./stories/${component}.svelte`];
if (!load) {
  root.textContent = `No Svelte stories for "${component}"`;
} else {
  const module = await load();
  const layout = module.layouts?.[story] ?? "centered";
  if (layout === "centered") {
    document.body.classList.add(
      "box-border",
      "flex",
      "min-h-screen",
      "items-center",
      "justify-center",
      "p-4",
    );
    root.classList.add("m-auto", "box-border", "p-4");
  } else if (layout === "padded") {
    document.body.classList.add("p-4");
  }
  mount(module.default, { target: root, props: { story } });
  document.body.dataset.storyReady = "true";
}
