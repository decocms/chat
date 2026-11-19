<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { AuthApi } from "./api";
  import { authIssue, authText, type AuthLanguage } from "./copy";
  import { createConsentSession } from "./session";
  import AuthFrame from "./AuthFrame.svelte";
  import AuthLogoutForm from "./AuthLogoutForm.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  let {
    api,
    search,
    lang,
    initialFailure = false,
  }: {
    api: AuthApi;
    search: string;
    lang: AuthLanguage;
    initialFailure?: boolean;
  } = $props();
  const session = untrack(() =>
      createConsentSession(api, search, undefined, initialFailure),
    ),
    view = session.state;
  let submitted = $state(false);
  let leaving = $state(false);
  const text = (
    key: Parameters<typeof authText>[1],
    vars?: Record<string, string>,
  ) => authText(lang, key, vars);
  onMount(() => {
    if (!initialFailure) void session.load();
    return () => session.dispose();
  });
</script>

<AuthFrame
  title={$view.context
    ? text("connect", { name: $view.context.client_name })
    : text("consentError")}
>
  {#if $view.loading}<p role="status" class="m-0 text-muted-foreground">
      {text("loading")}
    </p>
  {:else if $view.context}
    <section class="flex flex-col gap-3">
      <p class="m-0 break-words text-muted-foreground">
        {text("as", { email: $view.context.email })}
      </p>
      <ul class="m-0 flex list-disc flex-col gap-2 pl-5">
        <li>{text("rooms")}</li>
        <li>{text("read")}</li>
        <li>{text("post")}</li>
      </ul>
    </section>
    <section
      class="flex flex-col gap-2 border-t border-border pt-5 text-muted-foreground"
    >
      <p class="m-0">{text("cant")}</p>
      <p class="m-0 break-words">
        {$view.context.client_domain
          ? text("publisher", { domain: $view.context.client_domain })
          : text("unverified")}
        {text("goes", { host: $view.context.redirect_host })}
      </p>
      <p class="m-0 break-words text-xs">
        {text("scope")}: {$view.context.scope.join(", ")}
      </p>
    </section>
    {#if $view.context.redirect_is_loopback}<p
        role="note"
        class="m-0 rounded-control border border-warning bg-warning/10 p-4 text-foreground"
      >
        {text("local")}
      </p>{/if}
    <form
      method="post"
      action={`/authorize${search}`}
      aria-busy={submitted}
      class="grid grid-cols-2 gap-3"
      onsubmit={(event) => {
        if (submitted || leaving) event.preventDefault();
        else submitted = true;
      }}
    >
      <input type="hidden" name="handle" value={$view.context.handle} />
      <Button
        type="submit"
        name="decision"
        value="deny"
        variant="outline"
        size="lg"
        aria-disabled={submitted || leaving}>{text("cancel")}</Button
      >
      <Button
        type="submit"
        name="decision"
        value="approve"
        size="lg"
        aria-disabled={submitted || leaving}>{text("allow")}</Button
      >
    </form>
    {#if submitted}<p role="status" class="m-0 text-muted-foreground">
        {text("waiting")}
      </p>{/if}
    <div class="border-t border-border pt-5">
      <AuthLogoutForm
        next={`/authorize${search}`}
        {lang}
        blocked={submitted}
        onBegin={() => {
          leaving = true;
        }}
      />
    </div>
  {:else}<p role="alert" class="m-0 break-words text-destructive">
      {authIssue(lang, $view.error)}
    </p>
    {#if $view.signedOut}<a
        class={buttonVariants()}
        href={`/login?next=${encodeURIComponent("/authorize" + search)}`}
        >{text("login")}</a
      >{:else}<Button variant="outline" onclick={() => session.load()}
        >{text("retry")}</Button
      >{/if}{#if $view.returnTo}<a
        class={buttonVariants({ variant: "ghost" })}
        href={$view.returnTo}>{text("return")}</a
      >{/if}{/if}
</AuthFrame>
