<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "../studio/Icon.svelte";
  import Spinner from "../studio/Spinner.svelte";
  import { Pencil01, Upload01 } from "../studio/icons";
  import { cn } from "../studio/utils";

  /**
   * A picture you change: a person's photo or a room's icon. The picture is a
   * button with a pencil badge on its corner (the same on desktop and phones).
   * A click opens the file picker; an image dropped on the picture is taken
   * too. The caller draws the picture (`children`), converts the file and
   * saves it (`onfile`), and says when it is `busy`.
   */
  let {
    label,
    dropLabel,
    shape = "circle",
    accept = "image/png,image/jpeg,image/webp",
    busy = false,
    disabled = false,
    id,
    class: className,
    onfile,
    children,
  }: {
    /** The button's name, e.g. "Change icon". */
    label: string;
    /** The text while a file is over the picture, e.g. "Drop to upload". */
    dropLabel: string;
    /** The picture's shape: a person is a circle, a room is a square. */
    shape?: "circle" | "square";
    accept?: string;
    busy?: boolean;
    disabled?: boolean;
    /** The id of the hidden file input. */
    id?: string;
    class?: string;
    /** A file the person chose or dropped. `event` is the change or the drop. */
    onfile(file: File, event: Event): void;
    children: Snippet;
  } = $props();
  let input = $state<HTMLInputElement | null>(null),
    depth = $state(0);
  const off = $derived(disabled || busy),
    over = $derived(depth > 0 && !off),
    round = $derived(shape === "circle" ? "rounded-full" : "rounded-[30%]");
  const image = (event: DragEvent) =>
    [...(event.dataTransfer?.items ?? [])].some(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );
</script>

<button
  type="button"
  aria-label={label}
  title={label}
  disabled={off}
  aria-busy={busy || undefined}
  data-image-picker
  data-drag={over || undefined}
  class={cn(
    "group/picker relative inline-flex shrink-0 cursor-pointer border-0 bg-transparent p-0 outline-none disabled:cursor-default",
    round,
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    className,
  )}
  onclick={(event) => {
    if (!off && event.currentTarget.isConnected) input?.click();
  }}
  ondragenter={(event) => {
    if (off || !image(event)) return;
    event.preventDefault();
    depth++;
  }}
  ondragover={(event) => {
    if (off || !image(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }}
  ondragleave={() => {
    if (depth > 0) depth--;
  }}
  ondrop={(event) => {
    event.preventDefault();
    depth = 0;
    const file = [...(event.dataTransfer?.files ?? [])].find((file) =>
      file.type.startsWith("image/"),
    );
    if (!off && file && event.currentTarget.isConnected) onfile(file, event);
  }}
>
  {@render children()}
  {#if over || busy}<span
      aria-hidden="true"
      class={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        round,
        over
          ? "bg-primary/80 text-primary-foreground outline-2 outline-offset-2 outline-primary outline-dashed"
          : "bg-foreground/50 text-background",
      )}
      >{#if busy}<Spinner size="sm" />{:else}<Icon
          icon={Upload01}
          size={16}
        />{/if}</span
    >{/if}
  <span
    aria-hidden="true"
    class="pointer-events-none absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-xs transition-transform duration-150 group-hover/picker:scale-110 group-disabled/picker:opacity-60 motion-reduce:transition-none"
    ><Icon icon={Pencil01} size={11} /></span
  >
  {#if over}<span class="sr-only" role="status">{dropLabel}</span>{/if}
  <input
    bind:this={input}
    {id}
    type="file"
    {accept}
    tabindex={-1}
    aria-hidden="true"
    class="sr-only"
    disabled={off}
    onchange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (file && event.currentTarget.isConnected) onfile(file, event);
    }}
  />
</button>
