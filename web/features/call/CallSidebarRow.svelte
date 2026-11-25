<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import type { CallPeer } from "../../../shared/room";
  import { isRecorder } from "../../../shared/call";
  import type { CallSession } from "./session";
  /** The room's call in the sidebar, while a call is on: one row "Na call · n" with the faces and the way in or
   * out. The narrow rail: one green phone with the count. */
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

{#if people.length}{#if collapsed}<IconButton
      data-call-row
      label={inCall
        ? t("Sair da call")
        : t("Entrar na call: {people}", { people: who })}
      tooltipSide="right"
      variant={inCall ? "destructive" : "success"}
      class="relative size-8 rounded-full"
      onclick={() => (inCall ? call.leave() : call.join())}
      ><Icon icon={inCall ? "phone-hang-up" : "phone"} size={16} /><span
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
      {#if inCall}<IconButton
          label={t("Sair da call")}
          tooltipSide="right"
          variant="destructive"
          size="icon-xs"
          class="rounded-full"
          onclick={() => call.leave()}
          ><Icon icon="phone-hang-up" size={12} /></IconButton
        >{:else}<Button
          size="xs"
          variant="success"
          class="rounded-full"
          onclick={() => call.join()}>{t("Entrar na call")}</Button
        >{/if}
    </div>{/if}{/if}
