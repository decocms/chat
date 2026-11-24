<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import type { CallSession } from "./session";
  /** Starts the room's call: a control of the view (docs/design.md), shown while the room has no call. */
  let {
    call,
    t,
  }: {
    call: CallSession;
    t(text: string, vars?: Record<string, string | number>): string;
  } = $props();
</script>

<Button data-call-start size="sm" variant="outline" onclick={() => call.join()}
  ><Icon icon="phone-01" size={14} />{t("Iniciar call")}</Button
>
