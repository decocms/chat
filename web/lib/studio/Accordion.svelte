<script lang="ts" module>
  export const ACCORDION_LOCK = Symbol("studio-accordion-lock");
  export type AccordionLock = { readonly locked: boolean };
</script>

<script lang="ts">
  import { Accordion as AccordionPrimitive } from "bits-ui";
  import { setContext } from "svelte";

  /** Radix's `defaultValue` is the initial `value`; `collapsible` is kept because Bits always lets a single item close. */
  let {
    ref = $bindable(null),
    value = $bindable(),
    collapsible = false,
    onValueChange,
    ...rest
  }: AccordionPrimitive.RootProps & { collapsible?: boolean } = $props();

  const locked = $derived(rest.type === "single" && !collapsible);
  setContext<AccordionLock>(ACCORDION_LOCK, {
    get locked() {
      return locked;
    },
  });

  function update(next: string | string[] | undefined) {
    if (locked && next === "") return;
    value = next;
    (onValueChange as ((next: string | string[]) => void) | undefined)?.(
      next ?? "",
    );
  }
</script>

<AccordionPrimitive.Root
  bind:ref
  bind:value={() => value as string | undefined, update}
  data-slot="accordion"
  {...rest as { type: "single" }}
/>
