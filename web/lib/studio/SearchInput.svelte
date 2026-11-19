<script lang="ts">
  import Icon from "./Icon.svelte";
  import { SearchMd } from "./icons";
  import InputGroup from "./InputGroup.svelte";
  import InputGroupAddon from "./InputGroupAddon.svelte";
  import InputGroupInput from "./InputGroupInput.svelte";
  import Spinner from "./Spinner.svelte";

  /** A search field: the glass, or a spinner while results load. `value` binds; `onChange` still reports each edit. */
  let {
    value = $bindable(""),
    onChange,
    placeholder = "Search...",
    onKeyDown,
    class: className,
    isSearching,
    disabled,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    onKeyDown?: (
      event: KeyboardEvent & { currentTarget: HTMLInputElement },
    ) => void;
    class?: string;
    isSearching?: boolean;
    disabled?: boolean;
  } = $props();
</script>

<InputGroup size="sm" class={className}>
  <InputGroupAddon class="pr-0">
    {#if isSearching}
      <Spinner class="size-4" />
    {:else}
      <Icon icon={SearchMd} />
    {/if}
  </InputGroupAddon>
  <InputGroupInput
    type="text"
    bind:value={
      () => value,
      (next) => {
        value = next;
        onChange?.(next);
      }
    }
    onkeydown={onKeyDown}
    {placeholder}
    {disabled}
  />
</InputGroup>
