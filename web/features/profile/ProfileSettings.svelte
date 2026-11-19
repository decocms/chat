<script lang="ts">
  import { client } from "../../lib/client/api";
  import { ProfileSettingsResult } from "../../../shared/schemas";
  import { titleFor } from "../../../shared/titles";
  import Switch from "../../lib/studio/Switch.svelte";
  import { fetchProfile, forgetProfile } from "./api";
  import { profileText, type ProfileLang } from "./copy";

  /** Settings → profile: your title, the public page switch (off by default) and its link. */
  let { email, lang }: { email: string; lang: ProfileLang } = $props();
  let handle = $state(""),
    on = $state(false),
    title = $state(""),
    busy = $state(false);
  $effect(() => {
    void fetchProfile(email).then((p) => {
      if (!p) return;
      handle = p.handle;
      on = p.public;
      title = titleFor(p.totals, lang).title;
    });
  });
  async function set(wanted: boolean) {
    busy = true;
    try {
      const r = await client("/").api.me.profile.$post({
        json: { public: wanted },
      });
      const v = ProfileSettingsResult.safeParse(await r.json());
      if (r.ok && v.success) ({ handle, public: on } = v.data);
      forgetProfile(email);
    } finally {
      busy = false;
    }
  }
</script>

<!-- Not a <label>: a label around the switch button turns one click into two (on, then off again; #3638). -->
<div
  data-profile-settings
  class="flex items-center justify-between gap-4 px-4 py-3"
>
  <span class="flex min-w-0 flex-col gap-0.5">
    <span class="text-sm font-medium"
      >{profileText(lang, "publicOn")}{#if title}
        · <span class="text-brand-purple">{title}</span>{/if}</span
    >
    <span class="text-xs text-muted-foreground"
      >{#if on && handle}<a
          href={`/u/${handle}`}
          class="cursor-pointer text-link no-underline hover:underline"
          >{location.host}/u/{handle}</a
        >{:else}{profileText(lang, "private")}{/if}</span
    >
  </span>
  <Switch
    checked={on}
    disabled={busy || !handle}
    onCheckedChange={(v) => void set(v)}
    aria-label={profileText(lang, "publicOn")}
  />
</div>
