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
    "tw:flex tw:min-h-[var(--vb-studio-control-height,2.25rem)] tw:w-full tw:flex-wrap tw:items-center tw:gap-1 tw:rounded-[var(--vb-studio-control-radius,0.625rem)] tw:bg-[var(--vb-studio-input-background)] tw:px-1.5 tw:py-1.5 tw:text-sm tw:pointer-coarse:text-[16px] tw:shadow-edge tw:transition-[background-color,box-shadow] tw:hover:bg-sidebar tw:has-[:focus-visible]:outline-2 tw:has-[:focus-visible]:outline-offset-2 tw:has-[:focus-visible]:outline-ring tw:has-[:focus-visible]:outline-solid tw:has-[input:disabled]:pointer-events-none tw:has-[input:disabled]:text-subtle-foreground",
    className,
  )}
>
  {#each value as tag (tag)}
    {@const valid = validate?.(tag) ?? true}
    <Badge
      variant={valid ? "outline" : "destructive"}
      size="lg"
      class={cn(
        "tw:gap-1 tw:bg-card tw:pr-1",
        !valid && "tw:bg-destructive/10",
      )}
    >
      {tag}
      <button
        type="button"
        onclick={() => remove(tag)}
        aria-label={removeLabel(tag)}
        {disabled}
        class="tw:flex tw:size-4 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:hover:bg-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ring tw:focus-visible:outline-solid tw:disabled:cursor-not-allowed"
      >
        <Icon icon={X} class="tw:size-3" />
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
    class="tw:min-w-[8ch] tw:flex-1 tw:bg-transparent tw:px-1.5 tw:outline-none tw:placeholder:text-subtle-foreground"
  />
</div>
