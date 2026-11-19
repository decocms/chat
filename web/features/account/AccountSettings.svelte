<script lang="ts">
  import { untrack } from "svelte";
  import type { ComponentProps } from "svelte";
  import AccountPanel from "./AccountPanel.svelte";
  import AccountAgentSettings from "./AccountAgentSettings.svelte";
  import CloudSettings from "../sandboxes/CloudSettings.svelte";
  import DeviceAlerts from "../notifications/DeviceAlerts.svelte";
  import InstallCard from "../pwa/InstallCard.svelte";
  import { roomsOnly } from "../home/model";
  import type { AgentsService } from "../agents/service";
  import type { AgentFormatting } from "../agents/types";
  import type { PwaService } from "../pwa/service";
  let {
    pwa,
    agents,
    origin,
    vb,
    lang,
    room,
    ...panel
  }: Omit<
    ComponentProps<typeof AccountPanel>,
    "notifications" | "install" | "agentSettings" | "cloud" | "lang"
  > & {
    pwa: PwaService;
    agents: AgentsService;
    origin: string;
    vb: AgentFormatting;
    lang: "pt" | "en";
    /** Cloud agents start on this room (`/settings?room=`), else the one you opened last. */
    room: string | null;
  } = $props();
  const view = untrack(() => panel.owner.state),
    device = untrack(() => pwa.state);
  const rooms = $derived(
    [...roomsOnly($view.me?.books ?? [])]
      .sort((a, b) => (b.opened_at ?? 0) - (a.opened_at ?? 0))
      .map((book) => ({ id: book.id, title: book.title || book.id })),
  );
</script>

<AccountPanel {...panel} {lang}>
  {#snippet notifications(classes: { row: string; hint: string })}<DeviceAlerts
      owner={pwa}
      {lang}
      {...classes}
    />{/snippet}
  {#snippet install()}
    <!-- On iPhone/iPad Safari, notifications need the installed app. -->
    {#if $device.iosWeb}<InstallCard owner={pwa} {lang} />{/if}
  {/snippet}
  {#snippet agentSettings()}
    {#if $view.me && $view.binding}{#key $view.binding.account}
        <AccountAgentSettings
          account={$view.binding.account}
          {agents}
          {origin}
          {lang}
          {vb}
        />
      {/key}{/if}
  {/snippet}
  {#snippet cloud()}
    {#if $view.me && $view.binding}{#key $view.binding.account}
        <CloudSettings
          {agents}
          account={$view.binding.account}
          {rooms}
          {room}
          {lang}
        />
      {/key}{/if}
  {/snippet}
</AccountPanel>
