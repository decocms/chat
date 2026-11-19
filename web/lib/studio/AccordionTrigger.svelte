<script lang="ts">
  import { Accordion as AccordionPrimitive } from "bits-ui";
  import { getContext } from "svelte";
  import { ACCORDION_LOCK, type AccordionLock } from "./Accordion.svelte";
  import Icon from "./Icon.svelte";
  import { cn } from "./utils";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...rest
  }: Omit<AccordionPrimitive.TriggerProps, "style" | "class" | "child"> & {
    class?: string;
  } = $props();

  const lock = getContext<AccordionLock | undefined>(ACCORDION_LOCK);
</script>

<AccordionPrimitive.Header level={3}>
  {#snippet child({ props })}
    <h3 {...props} class="flex">
      <AccordionPrimitive.Trigger
        bind:ref
        data-slot="accordion-trigger"
        {...rest}
        class={cn(
          "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 flex flex-1 items-center justify-between gap-4 rounded-[0.625rem] px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-90",
          className,
        )}
      >
        {#snippet child({ props: trigger })}
          <!-- Radix marks the open item of a non-collapsible accordion as aria-disabled. -->
          <button
            type="button"
            {...trigger}
            aria-disabled={trigger.disabled ||
            (lock?.locked && trigger["data-state"] === "open")
              ? "true"
              : undefined}
          >
            {@render children?.()}
            <Icon
              icon="chevron-right"
              class="text-muted-foreground pointer-events-none size-4 shrink-0 transition-transform duration-200"
            />
          </button>
        {/snippet}
      </AccordionPrimitive.Trigger>
    </h3>
  {/snippet}
</AccordionPrimitive.Header>
