<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
  import IconButton from "./IconButton.svelte";
  import InputGroup from "./InputGroup.svelte";
  import InputGroupInput from "./InputGroupInput.svelte";

  /** A secret field with reveal and copy buttons; `class` goes to the group, everything else to the input. */
  let {
    class: className,
    value = $bindable(),
    showLabel = "Show",
    hideLabel = "Hide",
    copyLabel = "Copy",
    copiedLabel = "Copied",
    ref = $bindable(null),
    ...rest
  }: Omit<
    HTMLInputAttributes,
    "type" | "style" | "class" | "children" | "files"
  > & {
    /** Button names, translated by the caller. */
    showLabel?: string;
    hideLabel?: string;
    copyLabel?: string;
    copiedLabel?: string;
    class?: string;
    ref?: HTMLInputElement | null;
  } = $props();

  let visible = $state(false);
  let copied = $state(false);

  const copy = async () => {
    if (typeof value !== "string" || !value) return;
    // Denied on insecure origins or without permission; the label just stays.
    const ok = await navigator.clipboard.writeText(value).then(
      () => true,
      () => false,
    );
    if (!ok) return;
    copied = true;
    setTimeout(() => (copied = false), 2000);
  };
</script>

<InputGroup class={className}>
  <InputGroupInput
    bind:ref
    bind:value
    type={visible ? "text" : "password"}
    {...rest}
  />
  <IconButton
    type="button"
    label={visible ? hideLabel : showLabel}
    onclick={() => (visible = !visible)}
  >
    <Icon icon={visible ? "eye-off" : "eye"} />
  </IconButton>
  <IconButton
    type="button"
    label={copied ? copiedLabel : copyLabel}
    onclick={copy}
    disabled={!value}
  >
    <Icon icon={copied ? "check" : "copy-01"} />
  </IconButton>
</InputGroup>
