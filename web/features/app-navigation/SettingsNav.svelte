<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import {
    Cloud01,
    Phone01,
    Stars01,
    User01,
    type IconNode,
  } from "../../lib/studio/icons";
  import {
    SETTINGS_SECTIONS,
    settingsText,
    type SettingsSection,
  } from "../account/settings";
  import type { HomeLanguage } from "../home/copy";
  import HomeRow from "./HomeRow.svelte";
  import RoomRow from "./RoomRow.svelte";
  /** The settings page's sidebar (desktop, where Home has your DMs): Home, then the page's sections. */
  let { lang, onhome }: { lang: HomeLanguage; onhome: () => void } = $props();
  const icons: Record<SettingsSection, IconNode> = {
    profile: User01,
    agents: Stars01,
    cloud: Cloud01,
    device: Phone01,
  };
  let current = $state<SettingsSection>(
    SETTINGS_SECTIONS.find((id) => `#${id}` === location.hash) ?? "profile",
  );
  function go(id: SettingsSection) {
    current = id;
    history.replaceState(history.state, "", `#${id}`);
    document
      .getElementById(id)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
</script>

<nav
  data-settings-nav
  aria-label={settingsText(lang, "title")}
  class="flex flex-col gap-0.5"
>
  <HomeRow selected={false} waits={0} {lang} {onhome} />
  <p class="m-0 px-2 pt-4 pb-1 text-xs font-medium text-muted-foreground">
    {settingsText(lang, "title")}
  </p>
  {#each SETTINGS_SECTIONS as id (id)}<RoomRow
      href={`#${id}`}
      label={settingsText(lang, id)}
      selected={current === id}
      onopen={() => go(id)}
    >
      {#snippet leading()}<span
          class="grid size-9 shrink-0 place-items-center rounded-[0.6875rem] bg-muted"
          ><Icon icon={icons[id]} /></span
        >{/snippet}
    </RoomRow>{/each}
</nav>
