<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import type { CallPeer } from "../../../shared/room";
  import { isRecorder } from "../../../shared/call";
  import type { CallSession } from "./session";
  /** The room's call in the sidebar, while a call is on and I am not in it: one row "Na call · n" with the faces
   * and the way in. The narrow rail: one green phone with the count. In the call, the panel in the user center
   * (CallPanel) has the call. */
  let {
    call,
    peers = [],
    collapsed = false,
    avatar,
    name,
    t,
  }: {
    call: CallSession;
    peers?: readonly CallPeer[];
    collapsed?: boolean;
    avatar(email: string): number | null | undefined;
    name(email: string): string;
    t(text: string, vars?: Record<string, string | number>): string;
  } = $props();
  const view = $derived(call.state);
  const people = $derived(peers.filter((peer) => !isRecorder(peer.email)));
  const inCall = $derived($view.phase !== "idle");
  const who = $derived(people.map((peer) => name(peer.email)).join(", "));
</script>

{#if people.length && !inCall}{#if collapsed}<IconButton
      data-call-row
      label={t("Entrar na call: {people}", { people: who })}
      tooltipSide="right"
      variant="success"
      class="relative size-8 rounded-full"
      onclick={() => call.join()}
      ><Icon icon="phone" size={16} /><span
        class="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-foreground text-2xs font-semibold text-background tabular-nums"
        >{people.length}</span
      ></IconButton
    >{:else}<div
      data-call-row
      class="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-sidebar-accent px-2 text-sidebar-foreground"
      title={who}
    >
      <span
        class="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
        ><Icon icon="phone" size={11} /></span
      >
      <span class="shrink-0 font-medium"
        >{t("Na call · {n}", { n: people.length })}</span
      >
      <span class="flex min-w-0 flex-1 -space-x-1.5 overflow-hidden"
        >{#each people.slice(0, 4) as peer (peer.email)}<PersonAvatar
            email={peer.email}
            version={avatar(peer.email)}
            size="xs"
            class="size-5 ring-2 ring-sidebar-accent"
          />{/each}</span
      >
      <Button
        size="xs"
        variant="success"
        class="rounded-full"
        onclick={() => call.join()}>{t("Entrar na call")}</Button
      >
    </div>{/if}{/if}
