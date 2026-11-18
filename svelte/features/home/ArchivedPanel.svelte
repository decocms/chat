<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Card from "../../lib/studio/Card.svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import type { HomeBridge } from "./types";
  import { createArchivedSession } from "./session";
  import { homeText, homeIssue } from "./copy";
  import { targetHref } from "./model";
  import OrgAvatar from "../../lib/components/OrgAvatar.svelte";
  let { personal, lang, ago, onnavigate, onhome }: HomeBridge = $props();
  const session = untrack(() => createArchivedSession(personal)),
    view = session.state;
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  onDestroy(() => session.dispose());
  onMount(() => {
    let previous = personal.peek();
    const stop = personal.state.subscribe(({ me }) => {
      if (previous && me && me !== previous) void session.load();
      previous = me;
    });
    void session.load();
    return () => {
      stop();
      session.dispose();
    };
  });
</script>

<svelte:head><title>{text("archive")} · vibebook</title></svelte:head>
<main
  data-vb-native="archived"
  class="min-h-dvh md:min-h-full bg-background p-4 font-sans text-sm leading-6 text-foreground md:p-8"
>
  <div class="mx-auto max-w-5xl space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Heading level={1} class="m-0 text-2xl font-semibold"
          >{text("archive")}</Heading
        >
        <p class="m-0 text-muted-foreground">{text("archived")}</p>
      </div>
      <a
        href="/"
        class={buttonVariants({ variant: "outline" })}
        onclick={(event) => {
          if (
            !event.currentTarget.isConnected ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          onhome();
        }}>{text("back")}</a
      >
    </header>
    {#if $view.loading}<p role="status">
        {text($view.loaded ? "refreshing" : "loading")}
      </p>{/if}
    <div class="grid gap-4 md:grid-cols-2">
      {#each $view.books as room (room.id)}<Card class="block space-y-3"
          ><OrgAvatar
            name={room.title ?? "vibebook"}
            class="h-24 w-full rounded-control grayscale-60"
          />
          <Heading level={2} class="m-0 break-words text-lg font-semibold"
            >{room.title}</Heading
          >{#if room.summary}<p class="m-0 break-words text-muted-foreground">
              {room.summary}
            </p>{/if}
          <p class="m-0 text-xs text-muted-foreground">
            {text("archivedAgo", { ago: ago(room.archived_at) })}
          </p>
          <div class="flex flex-wrap gap-2">
            <a
              href={targetHref({ roomId: room.id })}
              class={buttonVariants({ variant: "ghost" })}
              onclick={(event) => {
                if (
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                if (event.currentTarget.isConnected)
                  onnavigate({ roomId: room.id });
              }}>{text("open")}</a
            ><Button
              variant="outline"
              aria-busy={$view.pending === room.id || undefined}
              disabled={!!$view.pending}
              onclick={(event) => {
                if (event.currentTarget.isConnected)
                  void session.restore(room.id);
              }}
              >{#if $view.pending === room.id}<Spinner size="xs" />{/if}{text(
                "restore",
              )}</Button
            >
          </div></Card
        >{/each}
    </div>
    {#if $view.loaded && !$view.books.length}<p>{text("noArchived")}</p>{/if}
    {#if $view.error}<p role="alert" class="break-words text-destructive">
        {homeIssue(lang, $view.error)}
      </p>
      <Button
        variant="outline"
        disabled={$view.loading}
        aria-busy={$view.loading || undefined}
        onclick={(event) => {
          if (event.currentTarget.isConnected) void session.load();
        }}
        >{#if $view.loading}<Spinner size="xs" />{/if}{text("retry")}</Button
      >{/if}
  </div>
</main>
