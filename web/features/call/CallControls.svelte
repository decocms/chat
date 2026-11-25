<script lang="ts">
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import type { CallPeer } from "../../../shared/room";
  import { isRecorder } from "../../../shared/call";
  import type { CallSession } from "./session";
  /** The room's call in the top bar (a control of the view, docs/design.md), while the stage is not on show: a
   * phone that starts the call, or, with a call on, a green phone with how many are in it. In the call with the
   * stage closed, the green phone opens the stage again. */
  let {
    call,
    peers = [],
    name,
    onopen,
    t,
  }: {
    call: CallSession;
    /** Who is in the room's call (room.call). */
    peers?: readonly CallPeer[];
    name(email: string): string;
    /** Opens the stage of the call I am in. */
    onopen(): void;
    t(text: string, vars?: Record<string, string | number>): string;
  } = $props();
  const people = $derived(peers.filter((peer) => !isRecorder(peer.email)));
  const view = $derived(call.state);
  const inCall = $derived($view.phase !== "idle");
</script>

{#if people.length}<IconButton
    data-call-start
    data-call-on
    label={inCall
      ? t("Voltar para a call")
      : t("Entrar na call: {people}", {
          people: people.map((peer) => name(peer.email)).join(", "),
        })}
    tooltipSide="bottom"
    variant="success"
    size="sm"
    class="h-8 gap-1 rounded-full px-2.5 tabular-nums"
    onclick={() => (inCall ? onopen() : call.join())}
    ><Icon icon="phone" size={14} />{people.length}</IconButton
  >{:else}<IconButton
    data-call-start
    label={t("Iniciar call")}
    tooltipSide="bottom"
    size="icon"
    class="text-muted-foreground hover:text-foreground"
    onclick={() => call.join()}><Icon icon="phone" size={18} /></IconButton
  >{/if}
