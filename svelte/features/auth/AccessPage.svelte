<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { AuthApi } from "./api";
  import { authIssue, authText, type AuthLanguage } from "./copy";
  import { createAccessSession } from "./session";
  import AuthFrame from "./AuthFrame.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import Spinner from "../../lib/studio/Spinner.svelte";
  let {
    api,
    id,
    auto,
    origin,
    lang,
    navigate,
    fileId,
  }: {
    api: AuthApi;
    id: string;
    auto: boolean;
    origin: string;
    lang: AuthLanguage;
    navigate: (url: string) => void;
    fileId?: string;
  } = $props();
  const session = untrack(() =>
      createAccessSession(
        api,
        id,
        fileId ? false : auto,
        navigate,
        undefined,
        fileId ? `#f${fileId}` : undefined,
      ),
    ),
    view = session.state;
  const text = (
    key: Parameters<typeof authText>[1],
    vars?: Record<string, string>,
  ) => authText(lang, key, vars);
  const roomURL = $derived(
    `/b/${encodeURIComponent(id)}?ui=svelte${fileId ? `#f${fileId}` : ""}`,
  );
  const loginURL = $derived(
    `/login?ui=svelte&next=${encodeURIComponent(fileId ? roomURL : roomURL + "&pedir=1")}`,
  );
  onMount(() => {
    void session.load();
    return () => session.dispose();
  });
</script>

<AuthFrame
  title={$view.context?.state === "missing"
    ? text("missing")
    : ($view.context?.title ?? text("access"))}
>
  {#if fileId}<p class="m-0 text-muted-foreground">
      {lang === "en"
        ? "Only room members can open this file. Sign in or ask for room access."
        : "Só quem está na sala abre este arquivo. Entre ou peça acesso à sala."}
    </p>{/if}
  {#if $view.loading && !$view.context}<p
      role="status"
      class="m-0 text-muted-foreground"
    >
      {text("loading")}
    </p>
  {:else if $view.context?.state === "missing"}<p
      class="m-0 text-muted-foreground"
    >
      {text("missingBody")}
    </p>
    <a class={buttonVariants()} href="/app?ui=svelte">{text("open")}</a>
  {:else if $view.context?.state === "out" || $view.signedOut}<p
      class="m-0 text-muted-foreground"
    >
      {text("closed")}
    </p>
    <a class={buttonVariants()} href={loginURL}>{text("signinAsk")}</a>
  {:else if $view.context?.state === "ask"}<p
      class="m-0 break-words text-muted-foreground"
    >
      {text("signed", { email: $view.context.email ?? "" })}
    </p>
    <Button
      disabled={$view.busy}
      aria-busy={$view.busy || undefined}
      onclick={() => session.ask()}
      >{#if $view.busy}<Spinner size="xs" />{/if}{text("ask")}</Button
    >
  {:else if $view.context?.state === "invited"}{#if $view.declined}<p
        role="status"
        class="m-0 text-muted-foreground"
      >
        {text("inviteDeclined")}
      </p>{:else}<p class="m-0 break-words text-muted-foreground">
        {text("invited", { who: $view.context.inviter ?? "" })}
      </p>
      <div class="flex flex-wrap gap-2" data-invite-answer>
        <Button
          disabled={$view.busy}
          aria-busy={$view.busy || undefined}
          onclick={() => session.answer(true)}
          >{#if $view.busy}<Spinner size="xs" />{/if}{text("join")}</Button
        ><Button
          variant="outline"
          disabled={$view.busy}
          onclick={() => session.answer(false)}>{text("declineInvite")}</Button
        >
      </div>{/if}
  {:else if $view.context?.state === "asked"}<p
      role="status"
      class="m-0 text-foreground"
    >
      ✓ {text("asked")}
    </p>
    <p class="m-0 text-muted-foreground">{text("askedBody")}</p>{/if}
  {#if $view.error}<p role="alert" class="m-0 break-words text-destructive">
      {authIssue(lang, $view.error)}
    </p>
    {#if $view.context?.state !== "ask" && $view.context?.state !== "invited"}<Button
        variant="outline"
        onclick={() => session.load()}>{text("retry")}</Button
      >{/if}{/if}
  {#if $view.context && $view.context.state !== "missing"}<p
      class="m-0 break-words text-xs text-muted-foreground"
    >
      {text("agent", { origin, url: origin + roomURL })}
    </p>{/if}
</AuthFrame>
