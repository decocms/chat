<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import type { AuthApi } from "./api";
  import type { AuthLanguage } from "./copy";
  import { authIssue, authText } from "./copy";
  import { authContinuation } from "./navigation";
  import { createLoginSession } from "./session";
  import AuthFrame from "./AuthFrame.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import ProviderIcon from "./ProviderIcon.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  let {
    api,
    search,
    origin,
    lang,
    navigate,
  }: {
    api: AuthApi;
    search: string;
    origin: string;
    lang: AuthLanguage;
    navigate: (url: string) => void;
  } = $props();
  const session = untrack(() =>
      createLoginSession(api, search, origin, navigate),
    ),
    view = session.state;
  let emailInput = $state<HTMLInputElement | null>(null),
    codeInput = $state<HTMLInputElement | null>(null);
  const text = (
    key: Parameters<typeof authText>[1],
    vars?: Record<string, string>,
  ) => authText(lang, key, vars);
  onMount(() => {
    void session.load();
    return () => session.dispose();
  });
  $effect(() => {
    const phase = $view.phase,
      ready = !!$view.context;
    if (ready)
      void tick().then(() => {
        (phase === "email" ? emailInput : codeInput)?.focus();
      });
  });
  const next = $derived(authContinuation($view.context?.next ?? "/", origin));
</script>

<AuthFrame title={$view.phase === "email" ? text("login") : text("check")}>
  {#if $view.loading}<p role="status" class="m-0 text-muted-foreground">
      {text("loading")}
    </p>
  {:else if !$view.context}<Button onclick={() => session.load()}
      >{text("retry")}</Button
    >
  {:else}
    {#if $view.phase === "email"}
      <p class="m-0 text-muted-foreground">{text("welcome")}</p>
      <div class="flex flex-col gap-2 pt-3">
        {#if $view.context.providers.google}<a
            class={buttonVariants({ variant: "outline" })}
            href={`/auth/google/start?next=${encodeURIComponent(next)}`}
            onclick={(event) => {
              if ($view.busy) event.preventDefault();
            }}><ProviderIcon provider="google" />{text("google")}</a
          >{/if}
        {#if $view.context.providers.github}<a
            class={buttonVariants({ variant: "outline" })}
            href={`/auth/github/start?next=${encodeURIComponent(next)}`}
            onclick={(event) => {
              if ($view.busy) event.preventDefault();
            }}><ProviderIcon provider="github" />{text("github")}</a
          >{/if}
        {#if $view.context.providers.google || $view.context.providers.github}<p
            class="m-0 mt-1 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border before:content-[''] after:h-px after:flex-1 after:bg-border after:content-['']"
          >
            {text("or")}
          </p>{/if}
      </div>
    {:else}<p class="m-0 break-words text-muted-foreground">
        {text("sent", { email: $view.email })}
      </p>{/if}
    <form
      class="space-y-3"
      onsubmit={(event) => {
        event.preventDefault();
        void session.submit();
      }}
      aria-busy={$view.busy}
    >
      {#if $view.phase === "email"}<Label for="auth-email"
          >{text("email")}</Label
        ><Input
          bind:ref={emailInput}
          id="auth-email"
          type="email"
          autocomplete="email"
          required
          disabled={$view.busy}
          value={$view.email}
          oninput={(event) => session.email(event.currentTarget.value)}
        />
      {:else}<Label for="auth-code">{text("code")}</Label><Input
          bind:ref={codeInput}
          id="auth-code"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength={6}
          pattern="[0-9]{6}"
          required
          disabled={$view.busy}
          value={$view.code}
          oninput={(event) => {
            session.code(event.currentTarget.value);
            if ($view.code.length === 6) void session.submit();
          }}
        />{/if}
      <Button
        type="submit"
        class="w-full"
        disabled={$view.busy}
        aria-busy={$view.busy || undefined}
        >{#if $view.busy}<Spinner size="xs" />{/if}{$view.phase === "email"
          ? text("send")
          : text("login")}</Button
      >
      {#if $view.phase === "code"}<Button
          variant="ghost"
          onclick={() => session.back()}>{text("another")}</Button
        >{/if}
    </form>
  {/if}
  {#if $view.error}<p
      role="alert"
      class="m-0 whitespace-pre-wrap break-words text-destructive"
    >
      {authIssue(lang, $view.error)}
    </p>{/if}
</AuthFrame>
