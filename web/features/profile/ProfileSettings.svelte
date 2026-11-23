<script lang="ts">
  import { client } from "../../lib/client/api";
  import {
    ProfileSettingsResult,
    SetHandleResult,
  } from "../../../shared/schemas";
  import { titleFor } from "../../../shared/titles";
  import Switch from "../../lib/studio/Switch.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import { fetchProfile, forgetProfile } from "./api";
  import { profileText, type ProfileLang } from "./copy";

  /** Settings → profile: your title, the public page switch (off by default) and its link. */
  let { email, lang }: { email: string; lang: ProfileLang } = $props();
  let handle = $state(""),
    on = $state(false),
    title = $state(""),
    busy = $state(false),
    draft = $state(""),
    handleNote = $state<"" | "handleTaken" | "handleInvalid" | "handleSaved">(
      "",
    );
  $effect(() => {
    void fetchProfile(email).then((p) => {
      if (!p) return;
      handle = p.handle;
      draft = p.handle;
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
  async function saveHandle() {
    busy = true;
    try {
      const r = await client("/").api.me.handle.$post({
        json: { handle: draft },
      });
      const v = SetHandleResult.safeParse(await r.json());
      if (r.ok && v.success) {
        handle = draft = v.data.handle;
        handleNote = "handleSaved";
        forgetProfile(email);
      } else handleNote = r.status === 409 ? "handleTaken" : "handleInvalid";
    } finally {
      busy = false;
    }
  }
</script>

<form
  data-handle-settings
  class="flex flex-col gap-1.5 px-4 py-3"
  onsubmit={(event) => {
    event.preventDefault();
    void saveHandle();
  }}
>
  <label for="profile-handle" class="text-sm font-medium"
    >{profileText(lang, "handle")}</label
  >
  <div class="flex items-center gap-2">
    <div class="relative min-w-0 flex-1">
      <span
        aria-hidden="true"
        class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
        >@</span
      ><Input
        id="profile-handle"
        bind:value={draft}
        oninput={() => (handleNote = "")}
        autocomplete="off"
        autocapitalize="off"
        spellcheck={false}
        maxlength={24}
        class="pl-7"
      />
    </div>
    <Button
      type="submit"
      variant="outline"
      disabled={busy || !draft.trim() || draft.trim() === handle}
      >{profileText(lang, "handleSave")}</Button
    >
  </div>
  <span
    role="status"
    class={handleNote === "handleTaken" || handleNote === "handleInvalid"
      ? "text-xs text-destructive"
      : "text-xs text-muted-foreground"}
    >{profileText(lang, handleNote || "handleHelp")}</span
  >
</form>

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
