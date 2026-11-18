<script lang="ts">
  import { Slider as SliderPrimitive } from "bits-ui";
  import { untrack } from "svelte";
  import { cn } from "./utils";

  type RootProps = Extract<SliderPrimitive.RootProps, { type: "multiple" }>;

  /** Ported from @decocms/ui `Slider`: `value` is always an array, one thumb per entry; `defaultValue` is an initial `value`. */
  let {
    value = $bindable(),
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    onValueChange,
    onValueCommit,
    thumbLabel,
    thumbValueText,
    onpointerdown,
    onkeydown,
    ref = $bindable(null),
    class: className,
    ...rest
  }: Omit<RootProps, "type" | "class" | "style" | "children" | "child"> & {
    class?: string;
    /** Each thumb's accessible name (the root's `aria-label` doesn't reach the focusable `role="slider"` thumb). */
    thumbLabel?: string;
    /** What a screen reader says for the value, e.g. "40%". */
    thumbValueText?: string;
  } = $props();

  // An uncontrolled slider starts at `min`; later changes to `min` do not reset it.
  value ??= [untrack(() => min)];
  // The thumb takes focus on press; the ring is for keyboard focus only.
  let pointer = $state(false);

  /** Radix's own names for the thumbs of a range, used when no label is given. */
  function label(index: number, total: number) {
    if (thumbLabel !== undefined) return thumbLabel;
    if (total > 2) return `Value ${index + 1} of ${total}`;
    if (total === 2) return index === 0 ? "Minimum" : "Maximum";
    return undefined;
  }

  /** Page Up and Page Down move ten steps, as in Radix; Bits UI leaves those keys alone. */
  function page(event: KeyboardEvent) {
    if (event.key !== "PageUp" && event.key !== "PageDown") return;
    if (disabled || typeof step !== "number" || !value || !ref) return;
    const thumbs = [...ref.querySelectorAll("[data-slot=slider-thumb]")];
    const index = thumbs.findIndex((thumb) => thumb === event.target);
    const current = value[index];
    if (current === undefined) return;
    event.preventDefault();
    const moved = current + (event.key === "PageUp" ? 10 : -10) * step;
    const snapped = Math.round((moved - min) / step) * step + min;
    const decimals = (String(step).split(".")[1] ?? "").length;
    const next = Number(
      Math.min(
        value[index + 1] ?? max,
        Math.max(value[index - 1] ?? min, snapped),
      ).toFixed(decimals),
    );
    if (next === current) return;
    const updated = value.map((entry, at) => (at === index ? next : entry));
    value = updated;
    onValueChange?.(updated);
    onValueCommit?.(updated);
  }
</script>

<SliderPrimitive.Root
  type="multiple"
  bind:value
  bind:ref
  {min}
  {max}
  {step}
  {disabled}
  {onValueChange}
  {onValueCommit}
  data-slot="slider"
  {...rest}
  data-pointer={pointer ? "" : undefined}
  onpointerdown={(event) => {
    pointer = true;
    onpointerdown?.(event);
  }}
  onkeydown={(event) => {
    pointer = false;
    onkeydown?.(event);
    page(event);
  }}
  class={cn(
    "relative flex w-full touch-none items-center py-2 select-none data-[disabled]:opacity-50 data-[orientation=vertical]:px-2 data-[orientation=vertical]:py-0 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
    className,
  )}
>
  {#snippet children({ thumbItems })}
    <span
      data-slot="slider-track"
      data-orientation={rest.orientation ?? "horizontal"}
      class="bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1"
    >
      <SliderPrimitive.Range
        data-slot="slider-range"
        class="bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
      />
    </span>
    <!-- The ::after pad grows the grab target to 40px without changing the knob. -->
    {#each thumbItems as thumb (thumb.index)}
      <SliderPrimitive.Thumb
        index={thumb.index}
        data-slot="slider-thumb"
        aria-label={label(thumb.index, thumbItems.length)}
        aria-valuetext={thumbValueText}
        class="relative block size-4 shrink-0 cursor-grab rounded-full bg-[#fff] shadow-edge transition-transform duration-150 after:absolute after:-inset-3 after:rounded-full after:content-[''] hover:scale-110 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 in-data-pointer:outline-none! active:scale-110 active:cursor-grabbing disabled:pointer-events-none motion-reduce:transition-none"
      />
    {/each}
  {/snippet}
</SliderPrimitive.Root>
