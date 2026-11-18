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
  data-native-settings-nav
  aria-label={settingsText(lang, "title")}
  class="tw:flex tw:flex-col tw:gap-0.5"
>
  <HomeRow selected={false} waits={0} {lang} {onhome} />
  <p
    class="tw:m-0 tw:px-2 tw:pt-4 tw:pb-1 tw:text-xs tw:font-medium tw:text-muted-foreground"
  >
    {settingsText(lang, "title")}
  </p>
  {#each SETTINGS_SECTIONS as id (id)}<RoomRow
      href={`#${id}`}
      label={settingsText(lang, id)}
      selected={current === id}
      onopen={() => go(id)}
    >
      {#snippet leading()}<span
          class="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-[0.6875rem] tw:bg-muted"
          ><Icon icon={icons[id]} /></span
        >{/snippet}
    </RoomRow>{/each}
</nav>
