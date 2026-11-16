<script lang="ts">
  import { Accordion as AccordionPrimitive } from "bits-ui";
  import { getContext } from "svelte";
  import { ACCORDION_LOCK, type AccordionLock } from "./Accordion.svelte";
  import Icon from "./Icon.svelte";
  import { ChevronRight } from "./icons";
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
    <h3 {...props} class="tw:flex">
      <AccordionPrimitive.Trigger
        bind:ref
        data-slot="accordion-trigger"
        {...rest}
        class={cn(
          "tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:flex tw:flex-1 tw:items-center tw:justify-between tw:gap-4 tw:rounded-[0.625rem] tw:px-3 tw:py-2.5 tw:text-left tw:text-sm tw:font-medium tw:transition-colors tw:hover:bg-accent tw:cursor-pointer tw:disabled:cursor-not-allowed tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:[&[data-state=open]>svg]:rotate-90",
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
              icon={ChevronRight}
              class="tw:text-muted-foreground tw:pointer-events-none tw:size-4 tw:shrink-0 tw:transition-transform tw:duration-200"
            />
          </button>
        {/snippet}
      </AccordionPrimitive.Trigger>
    </h3>
  {/snippet}
</AccordionPrimitive.Header>
