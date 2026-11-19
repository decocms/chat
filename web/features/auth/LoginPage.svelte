<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { AuthApi } from "./api";
  import type { AuthLanguage } from "./copy";
  import { authIssue, authText } from "./copy";
  import { authContinuation } from "./navigation";
  import { createLoginSession } from "./session";
  import AuthFrame from "./AuthFrame.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  // Sign-in is with deco Studio: the button goes to /auth/studio/start, which sends the person to Studio and back.
  let {
    api,
    search,
    origin,
    lang,
  }: {
    api: AuthApi;
    search: string;
    origin: string;
    lang: AuthLanguage;
  } = $props();
  const session = untrack(() => createLoginSession(api, search)),
    view = session.state;
  const text = (key: Parameters<typeof authText>[1]) => authText(lang, key);
  onMount(() => {
    void session.load();
    return () => session.dispose();
  });
  const next = $derived(authContinuation($view.context?.next ?? "/", origin));
</script>

<AuthFrame title={text("login")}>
  {#if $view.loading}<p role="status" class="m-0 text-muted-foreground">
      {text("loading")}
    </p>
  {:else if !$view.context}<Button onclick={() => session.load()}
      >{text("retry")}</Button
    >
  {:else}
    <p class="m-0 text-muted-foreground">{text("welcome")}</p>
    <a
      class={buttonVariants({ class: "w-full" })}
      href={`/auth/studio/start?next=${encodeURIComponent(next)}`}
      >{text("deco")}</a
    >
  {/if}
  {#if $view.error}<p
      role="alert"
      class="m-0 whitespace-pre-wrap break-words text-destructive"
    >
      {authIssue(lang, $view.error)}
    </p>{/if}
</AuthFrame>
