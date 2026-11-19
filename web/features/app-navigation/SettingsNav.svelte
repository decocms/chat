<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import {
    Cloud01,
    Phone01,
    Stars01,
    User01,
    type IconNode,
  } from "../../lib/studio/icons";
  import SidebarHeader from "../../lib/components/SidebarHeader.svelte";
  import {
    SETTINGS_SECTIONS,
    settingsText,
    type SettingsSection,
  } from "../account/settings";
  import type { HomeLanguage } from "../home/copy";
  import HomeRow from "./HomeRow.svelte";
  import RoomRow from "./RoomRow.svelte";
  /**
   * The settings page's sidebar (desktop), built like the DM list (DmNav):
   * "Configurações" names it in the header row, then the Home row, then the
   * page's sections as rows of the same size, with an icon like Home's.
   */
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
  class="flex min-h-0 flex-col gap-3 font-sans"
>
  <SidebarHeader class="md:pr-2 md:pl-4"
    ><h2 class="m-0 min-w-0 flex-1 truncate text-sm font-semibold">
      {settingsText(lang, "title")}
    </h2></SidebarHeader
  >
  <ul class="m-0 flex min-h-0 list-none flex-col gap-0.5 overflow-y-auto p-0">
    <li><HomeRow selected={false} waits={0} {lang} {onhome} /></li>
    {#each SETTINGS_SECTIONS as id (id)}<li>
        <RoomRow
          href={`#${id}`}
          label={settingsText(lang, id)}
          selected={current === id}
          onopen={() => go(id)}
        >
          {#snippet leading()}<Icon
              icon={icons[id]}
              size={16}
              class="shrink-0 text-muted-foreground"
            />{/snippet}
        </RoomRow>
      </li>{/each}
  </ul>
</nav>
