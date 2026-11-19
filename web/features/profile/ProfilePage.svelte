<script lang="ts">
  import type { ProfileResult } from "../../../shared/schemas";
  import AuthFrame from "../auth/AuthFrame.svelte";
  import { fetchProfile } from "./api";
  import { profileText, type ProfileLang } from "./copy";
  import ProfileView from "./ProfileView.svelte";

  /** /u/<handle>: anyone may open it; the server answers only what the viewer may see. */
  let {
    handle,
    lang,
    load = fetchProfile,
  }: {
    handle: string;
    lang: ProfileLang;
    load?: (who: string) => Promise<ProfileResult | null>;
  } = $props();
  let state = $state<"loading" | "missing" | ProfileResult>("loading");
  $effect(() => {
    void load(handle).then((p) => (state = p ?? "missing"));
  });
</script>

<svelte:head
  ><title
    >{typeof state === "object" ? state.name : "deco.chat"} · deco.chat</title
  ></svelte:head
>
{#if state === "loading"}<main
    class="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground"
  >
    {profileText(lang, "loading")}
  </main>{:else if state === "missing"}<AuthFrame
    title={profileText(lang, "missing")}
    ><p>{profileText(lang, "missingBody")}</p></AuthFrame
  >{:else}<main
    data-view="profile"
    class="min-h-dvh bg-background font-sans text-foreground"
  >
    <nav
      class="mx-auto flex max-w-4xl items-center justify-between px-4 pt-4 md:px-8"
    >
      <a
        href="/"
        class="inline-flex items-center gap-2 text-base font-semibold text-foreground no-underline"
        ><img
          src="/favicon.svg"
          alt=""
          width="24"
          height="24"
          class="size-6 rounded-md"
        />deco.chat</a
      >
      {#if !state.self}<a
          href="/"
          class="cursor-pointer text-sm font-medium text-link no-underline hover:underline"
          >{profileText(lang, "join")}</a
        >{/if}
    </nav>
    <ProfileView profile={state} {lang} />
  </main>{/if}
