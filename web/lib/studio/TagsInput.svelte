<script lang="ts" module>
  const DEFAULT_DELIMITERS = [",", ";", "\n"];
  const defaultRemoveLabel = (tag: string) => `Remove ${tag}`;
</script>

<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import Badge from "./Badge.svelte";
  import Icon from "./Icon.svelte";
  import { X } from "./icons";
  import { cn } from "./utils";

  /** Free text that turns into tags: emails, keywords, labels. `bind:value` replaces React's `defaultValue`/`value` pair. */
  let {
    value = $bindable([]),
    onValueChange,
    delimiters = DEFAULT_DELIMITERS,
    validate,
    removeLabel = defaultRemoveLabel,
    placeholder,
    disabled,
    class: className,
    onkeydown,
    onblur,
    onpaste,
    ref = $bindable(null),
    ...rest
  }: Omit<
    HTMLInputAttributes,
    "value" | "style" | "class" | "children" | "files"
  > & {
    value?: string[];
    onValueChange?: (tags: string[]) => void;
    /** Characters that end a tag while typing or pasting. Enter always does. */
    delimiters?: string[];
    /** False marks a tag as invalid: it stays, painted red, so it can be fixed. */
    validate?: (tag: string) => boolean;
    /** Accessible name of each tag's remove button, translated by the caller. */
    removeLabel?: (tag: string) => string;
    class?: string;
    ref?: HTMLInputElement | null;
  } = $props();

  let draft = $state("");

  function setTags(next: string[]) {
    value = next;
    onValueChange?.(next);
  }

  function add(text: string) {
    const pattern = new RegExp(
      `[${delimiters.map((d) => d.replace(/[\\^\]-]/g, "\\$&")).join("")}]`,
    );
    const next = text
      .split(pattern)
      .map((part) => part.trim())
      .filter((part) => part && !value.includes(part));
    if (next.length > 0) setTags([...value, ...new Set(next)]);
  }

  function remove(tag: string) {
    setTags(value.filter((t) => t !== tag));
  }

  function commitDraft() {
    add(draft);
    draft = "";
  }
</script>

<div
  data-slot="tags-input"
  class={cn(
    "flex min-h-[var(--vb-studio-control-height,2.25rem)] w-full flex-wrap items-center gap-1 rounded-[var(--vb-studio-control-radius,0.625rem)] bg-[var(--vb-studio-input-background)] px-1.5 py-1.5 text-sm pointer-coarse:text-[16px] shadow-edge transition-[background-color,box-shadow] hover:bg-sidebar has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-solid has-[input:disabled]:pointer-events-none has-[input:disabled]:text-subtle-foreground",
    className,
  )}
>
  {#each value as tag (tag)}
    {@const valid = validate?.(tag) ?? true}
    <Badge
      variant={valid ? "outline" : "destructive"}
      size="lg"
      class={cn("gap-1 bg-card pr-1", !valid && "bg-destructive/10")}
    >
      {tag}
      <button
        type="button"
        onclick={() => remove(tag)}
        aria-label={removeLabel(tag)}
        {disabled}
        class="flex size-4 cursor-pointer items-center justify-center rounded-full hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid disabled:cursor-not-allowed"
      >
        <Icon icon={X} class="size-3" />
      </button>
    </Badge>
  {/each}
  <input
    bind:this={ref}
    data-slot="tags-input-input"
    {...rest}
    bind:value={draft}
    onkeydown={(event) => {
      onkeydown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === "Enter" || delimiters.includes(event.key)) {
        if (!draft.trim()) return;
        event.preventDefault();
        commitDraft();
      } else if (event.key === "Backspace" && !draft && value.length > 0) {
        remove(value[value.length - 1]!);
      }
    }}
    onblur={(event) => {
      onblur?.(event);
      if (draft.trim()) commitDraft();
    }}
    onpaste={(event) => {
      onpaste?.(event);
      if (event.defaultPrevented) return;
      const text = event.clipboardData?.getData("text") ?? "";
      if (!delimiters.some((d) => text.includes(d))) return;
      event.preventDefault();
      add(text);
    }}
    placeholder={value.length === 0 ? placeholder : undefined}
    {disabled}
    class="min-w-[8ch] flex-1 bg-transparent px-1.5 outline-none placeholder:text-subtle-foreground"
  />
</div>
