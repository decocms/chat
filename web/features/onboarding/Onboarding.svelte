<script lang="ts">
  import ImagePicker from "../../lib/components/ImagePicker.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { untrack, tick } from "svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import SetupInstructions from "../agents/SetupInstructions.svelte";
  import { avatarImage } from "../account/image";
  import { homeIssue } from "../home/copy";
  import type { OnboardingSession } from "./session";
  import { onboardingText } from "./copy";
  let {
    owner,
    lang,
    onlanguage,
  }: {
    owner: OnboardingSession;
    lang: "pt" | "en";
    onlanguage(lang: "pt" | "en"): void;
  } = $props();
  const view = untrack(() => owner.state),
    account = untrack(() => owner.personal.state),
    profile = untrack(() => owner.profile.state),
    creator = untrack(() => owner.creator.state),
    draft = untrack(() => owner.personal.draft);
  const text = (key: Parameters<typeof onboardingText>[1], n?: number) =>
    onboardingText(lang, key, n);
  const busyProfile = $derived(
    ["pending", "confirming", "unconfirmed"].includes($profile.phase),
  );
  let nameInput = $state<HTMLInputElement | null>(null),
    roomInput = $state<HTMLTextAreaElement | null>(null);
  const focusScope = $derived(
    $view.visible
      ? `${$account.identityRevision}:${$account.me?.email}:${$view.step}`
      : "",
  );
  const actionScope = $derived(
    `${focusScope}:${$view.profileBinding?.generation ?? "-"}:${$view.creatorBinding?.generation ?? "-"}`,
  );
  $effect(() => {
    const scope = focusScope;
    if (!scope) return;
    const before = document.activeElement;
    void tick().then(() => {
      if (
        !owner.current() ||
        focusScope !== scope ||
        (document.activeElement !== before &&
          document.activeElement !== document.body &&
          document.activeElement !== document.documentElement)
      )
        return;
      const target =
        $view.step === 1 ? nameInput : $view.step === 3 ? roomInput : null;
      if (target?.isConnected) target.focus();
    });
  });
  // A connected outgoing step may survive until Svelte flushes. Its DOM scope
  // must still match the canonical presentation before a gesture can act.
  const live = (event: Event) =>
    owner.current() &&
    $view.visible &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected &&
    event.currentTarget
      .closest("[data-onboarding]")
      ?.getAttribute("data-onboarding-scope") === owner.actionScope();
</script>

<main
  data-onboarding
  data-onboarding-step={$view.step}
  data-onboarding-scope={actionScope}
  class="flex min-h-dvh flex-col items-center bg-background px-4 py-6 font-sans text-sm leading-6 text-foreground"
>
  <header class="mb-16 flex w-full max-w-xl flex-wrap items-center gap-3">
    <a
      href="/"
      class="flex-1 font-sans text-2xl font-semibold tracking-normal text-primary no-underline"
      >deco.chat</a
    >
    <div aria-label={text("language")} class="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={lang === "pt"}
        onclick={(event) => {
          if (live(event)) onlanguage("pt");
        }}>PT</Button
      ><Button
        variant="ghost"
        size="sm"
        aria-pressed={lang === "en"}
        onclick={(event) => {
          if (live(event)) onlanguage("en");
        }}>EN</Button
      >
    </div>
  </header>
  <section class="grid w-full max-w-xl gap-4">
    <div
      aria-label={text("step", $view.step)}
      class="flex items-center gap-2 text-xs text-muted-foreground"
    >
      {#each [1, 2, 3] as step}<span
          aria-hidden="true"
          class={step <= $view.step
            ? "h-1 w-6 rounded-full bg-primary"
            : "h-1 w-6 rounded-full bg-border"}
        ></span>{/each}<span>{text("step", $view.step)}</span>
    </div>
    {#if $view.step === 1}
      <Heading level={1} class="text-3xl leading-tight"
        >{text("nameTitle")}</Heading
      >
      <p class="m-0 text-base text-muted-foreground">
        {text("nameHelp")}
      </p>
      <form
        class="flex gap-2"
        onsubmit={(event) => {
          event.preventDefault();
          if (live(event)) owner.continueName();
        }}
      >
        <Input
          bind:ref={nameInput}
          value={$view.name}
          oninput={(event) => {
            if (live(event)) owner.editName(event.currentTarget.value);
          }}
          placeholder={text("name")}
          aria-label={text("name")}
          required
          maxlength={60}
          autocomplete="given-name"
          disabled={busyProfile || !$view.profileBinding}
        /><Button type="submit" disabled={busyProfile || !$view.profileBinding}
          >{text("next")}</Button
        >
      </form>
      <div class="flex items-center gap-3">
        <ImagePicker
          id="onboarding-photo"
          label={text($account.me?.avatar ? "changePhoto" : "photoLabel")}
          dropLabel={text("dropPhoto")}
          disabled={busyProfile || !$view.profileBinding}
          onfile={(file, event) => {
            if (live(event))
              owner.photo((current) => avatarImage(file, current));
          }}
          ><PersonAvatar
            size="lg"
            email={$account.me?.email}
            version={$account.me?.avatar}
          /></ImagePicker
        ><label
          for="onboarding-photo"
          class="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
          >{text($account.me?.avatar ? "changePhoto" : "photo")}</label
        >
      </div>
      {#if $profile.phase === "pending" || $profile.phase === "confirming"}<p
          role="status"
          class="m-0 text-muted-foreground"
        >
          {text("pending")}
        </p>{:else if $profile.phase === "error"}<p
          role="alert"
          class="m-0 text-destructive"
        >
          {text("failed")}
        </p>{:else if $profile.phase === "unconfirmed"}<p
          role="status"
          class="m-0 text-muted-foreground"
        >
          {text("unconfirmed")}
        </p>
        <Button
          variant="outline"
          onclick={(event) => {
            if (live(event)) owner.reviewProfile();
          }}>{text("reviewed")}</Button
        >{/if}
    {:else if $view.step === 2}
      <Heading level={1} class="text-3xl leading-tight"
        >{text("claudeTitle")}</Heading
      >
      <p class="m-0 text-base text-muted-foreground">
        {text("claudeHelp")}
      </p>
      {#if $view.connectedNotice}<p
          role="status"
          class="m-0 rounded-surface border border-border p-4 font-semibold text-success"
        >
          ✓ {text("connected")}
        </p>{:else}<SetupInstructions
          origin={location.origin}
          {lang}
          intro={false}
          current={owner.current}
        />{/if}
      <div class="flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          onclick={(event) => {
            if (live(event)) owner.back();
          }}>{text("back")}</Button
        ><Button
          variant="ghost"
          onclick={(event) => {
            if (live(event)) owner.skipClaude();
          }}>{text("skipClaude")}</Button
        >
      </div>
    {:else}
      <Heading level={1} class="text-3xl leading-tight"
        >{text("roomTitle")}</Heading
      >
      <p class="m-0 text-base text-muted-foreground">
        {text("roomHelp")}
      </p>
      <form
        onsubmit={(event) => {
          event.preventDefault();
          if (live(event)) void owner.createRoom();
        }}
      >
        <Textarea
          bind:ref={roomInput}
          rows={3}
          value={$draft.create}
          oninput={(event) => {
            if (live(event)) owner.editRoom(event.currentTarget.value);
          }}
          required
          aria-label={text("roomTitle")}
          placeholder={text("roomPlaceholder")}
          disabled={$creator.busy || !$view.creatorBinding}
          onkeydown={(event) => {
            if (
              live(event) &&
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.isComposing
            ) {
              event.preventDefault();
              void owner.createRoom();
            }
          }}
        />{#if $creator.error}<p role="alert" class="text-sm text-destructive">
            {homeIssue(lang, $creator.error)}
          </p>{/if}
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            onclick={(event) => {
              if (live(event)) owner.back();
            }}>{text("back")}</Button
          ><Button
            type="submit"
            disabled={$creator.busy || !$view.creatorBinding}
            >{text($creator.busy ? "creating" : "create")}</Button
          >
        </div>
      </form>
    {/if}
  </section>
  <div class="mt-auto pt-8">
    <Button
      variant="ghost"
      size="sm"
      class="text-muted-foreground"
      onclick={(event) => {
        if (live(event)) owner.skipHome();
      }}>{text("skipHome")}</Button
    >
  </div>
</main>
