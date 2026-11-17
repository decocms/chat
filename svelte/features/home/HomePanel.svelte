<script lang="ts">
  import { onMount, onDestroy, untrack, tick } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import Button from "../../lib/studio/Button.svelte";
  import InstallCard from "../pwa/InstallCard.svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import ChatField from "../composer/ChatField.svelte";
  import { createApplicationCopy } from "../application/copy";
  import OrgAvatar from "../../lib/components/OrgAvatar.svelte";
  import type { HomeBridge } from "./types";
  import { createHomeSession } from "./session";
  import { homeText, homeIssue } from "./copy";
  import {
    destinations,
    roomIcon,
    targetHref,
    waitTarget,
    plainWaitText,
    claudeWait,
    personAvatar,
    waitKind,
    type WaitKind,
  } from "./model";
  import Icon from "../../lib/studio/Icon.svelte";
  import { Check, Inbox01 } from "../../lib/studio/icons";
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { mountCube } from "./cube";
  import { byImportance, fanClasses, inFan } from "./deskHand";
  import Onboarding from "../onboarding/Onboarding.svelte";
  import { createOnboardingSession } from "../onboarding/session";
  let {
    pwa,
    personal,
    rooms,
    profile,
    creator,
    onlanguage,
    lang,
    ago,
    onnavigate,
    onhome,
    onarchived,
    onnew,
    onsettings,
    onroomsettings,
    onsearch,
    oninbox,
  }: HomeBridge = $props();
  const account = $derived(personal.state),
    draft = $derived(personal.draft);
  const mobile = new MediaQuery("(max-width:720px)");
  const session = untrack(() => createHomeSession(personal, onnavigate)),
    view = session.state;
  const onboarding = untrack(() => {
      let storage: Storage | null = null;
      try {
        storage = localStorage;
      } catch {
        /* Browser storage may be disabled. */
      }
      return createOnboardingSession(personal, profile, creator, { storage });
    }),
    onboardingView = onboarding.state;
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  const t = $derived(createApplicationCopy(lang));
  let sendButton = $state<HTMLElement | null>(null);
  const suggestion = $derived($view.result);
  // The desk home: what waits on you as a hand of cards, most important in the middle.
  const waits = $derived(byImportance($account.me?.waits ?? []));
  // Triage filters over the cards; a filter with nothing in it hides. Picking
  // one scrolls down to the cards, so they deal out already filtered.
  let filter = $state<"all" | WaitKind>("all");
  let filterBar = $state<HTMLElement | null>(null);
  const filters = $derived.by(() => {
    const count = (kind: WaitKind) =>
      waits.filter((wait) => waitKind(wait) === kind).length;
    return [
      { kind: "all" as const, label: text("filterAll"), count: waits.length },
      {
        kind: "claude" as const,
        label: text("filterClaude"),
        count: count("claude"),
      },
      {
        kind: "asks" as const,
        label: text("filterAsks"),
        count: count("asks"),
      },
      {
        kind: "reviews" as const,
        label: text("filterReviews"),
        count: count("reviews"),
      },
    ].filter((option) => option.kind === "all" || option.count);
  });
  const shown = $derived(
    filter === "all"
      ? waits
      : waits.filter((wait) => waitKind(wait) === filter),
  );
  $effect(() => {
    // A filter that emptied (its last wait was answered) falls back to all.
    if (filter !== "all" && !shown.length) filter = "all";
  });
  async function pick(kind: "all" | WaitKind) {
    filter = kind;
    await tick();
    if (!filterBar?.isConnected) return;
    const box = scroller(),
      behavior: ScrollBehavior = reducedMotion.current ? "auto" : "smooth";
    const offset =
      filterBar.getBoundingClientRect().top -
      (box ? box.getBoundingClientRect().top : 0) -
      16;
    if (box)
      box.scrollTo({ top: Math.max(box.scrollTop + offset, 8), behavior });
    else scrollTo({ top: Math.max(scrollY + offset, 8), behavior });
  }
  const headline = $derived(
    waits.length === 0
      ? text("deskNone")
      : waits.length === 1
        ? text("deskOne")
        : text("deskMany", { n: waits.length }),
  );
  let home = $state<HTMLElement | null>(null),
    hand = $state<HTMLElement | null>(null),
    cube = $state<HTMLCanvasElement | null>(null),
    dealt = $state(false);
  const reducedMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
  const phone = new MediaQuery("(max-width: 720px)");
  // Scrolling down deals the hand into a grid; back at the top it fans again.
  // What scrolls depends on the width: the app frame on a desktop (#92), the
  // window on a phone. Both are read through the nearest scrolling ancestor.
  function scroller() {
    for (let el = home?.parentElement; el; el = el.parentElement) {
      const overflow = getComputedStyle(el).overflowY;
      if (overflow === "auto" || overflow === "scroll") return el;
    }
    return null;
  }
  const scrolled = () => {
    const box = scroller();
    return box ? box.scrollTop : scrollY;
  };
  function onscroll() {
    const y = scrolled();
    const next = y > 4 ? true : y <= 0 ? false : dealt;
    if (next !== dealt) void deal(next);
  }
  // The deal moves each card from where it stood to where it lands (FLIP):
  // measured before and after the classes change, played with the Web
  // Animations API so nothing but the motion lives in script.
  async function deal(next: boolean) {
    const cards = hand
      ? [...hand.querySelectorAll<HTMLElement>("[data-home-card]")]
      : [];
    const before = cards.map((card) => card.getBoundingClientRect());
    dealt = next;
    if (reducedMotion.current || !cards.length) return;
    await tick();
    cards.forEach((card, i) => {
      const from = before[i];
      if (!from || !card.isConnected) return;
      card.getAnimations().forEach((animation) => animation.cancel());
      const to = card.getBoundingClientRect();
      if (!to.width || !to.height) return;
      const final = getComputedStyle(card).transform;
      const dx = from.left + from.width / 2 - (to.left + to.width / 2),
        dy = from.top + from.height / 2 - (to.top + to.height / 2);
      card.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height}) ${final === "none" ? "" : final}`,
          },
          { transform: final },
        ],
        {
          duration: 280,
          delay: Math.min(i, 6) * 8,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
          fill: "backwards",
        },
      );
    });
  }
  $effect(() => {
    // Capture: scroll events from the frame do not bubble to the window.
    document.addEventListener("scroll", onscroll, {
      passive: true,
      capture: true,
    });
    return () =>
      document.removeEventListener("scroll", onscroll, { capture: true });
  });
  $effect(() => {
    if (cube) return mountCube(cube);
  });
  const place = (choice: ReturnType<typeof destinations>[number]) =>
    choice.book_id
      ? choice.book_title + (choice.epic_title ? " › " + choice.epic_title : "")
      : text("newDestination", { title: choice.book_title });
  const who = (wait: (typeof waits)[number]) =>
    claudeWait(wait)
      ? text("yourClaude")
      : wait.author === "ai"
        ? "@vibe"
        : wait.author_name || wait.author.split("@")[0] || "";
  const plainClick = (event: MouseEvent) =>
    !(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey);
  $effect(() => {
    if (suggestion)
      void tick().then(() => {
        if (sendButton?.isConnected) sendButton.focus();
      });
  });
  let mounted = false,
    agentTimer: ReturnType<typeof setTimeout> | undefined,
    copyStatus = $state("");
  onDestroy(() => {
    onboarding.dispose();
    session.dispose();
  });
  onMount(() => {
    mounted = true;
    void personal.refresh();
    const poll = () => {
      if (!mounted) return;
      if (!$onboardingView.visible && !$account.agents?.agents.length)
        void personal.refreshAgents();
      agentTimer = setTimeout(poll, 15_000);
    };
    poll();
    return () => {
      mounted = false;
      clearTimeout(agentTimer);
      session.dispose();
    };
  });
  const setup = $derived(
    `Read ${location.origin}/llms.txt and set up vibebook for this project.`,
  );
  async function copy() {
    try {
      if (!navigator.clipboard) throw Error("unavailable");
      await navigator.clipboard.writeText(setup);
      if (mounted) copyStatus = "copied";
    } catch {
      if (mounted) copyStatus = "copyFailed";
    }
  }
</script>

<!-- Connecting an agent, inline under the ask box: the agents' marks, the
     instruction itself and one click to copy it for Claude Code. -->
{#snippet connectAgent()}<div
    data-home-connect
    class="tw:flex tw:w-full tw:flex-col tw:gap-2.5 tw:rounded-2xl tw:bg-card tw:p-3 tw:text-left tw:shadow-edge"
  >
    <div class="tw:flex tw:items-center tw:gap-2.5">
      <span class="tw:flex tw:shrink-0 tw:items-center tw:-space-x-1.5"
        >{#each ["claude", "codex", "gemini"] as via (via)}<AgentMark
            {via}
            tint
            size="xs"
            class="tw:rounded-full tw:ring-2 tw:ring-card"
          />{/each}</span
      >
      <b class="tw:min-w-0 tw:flex-1 tw:truncate tw:font-medium"
        >{text("setup")}</b
      >
      <Button size="sm" class="tw:shrink-0" onclick={copy}
        >{#if copyStatus === "copied"}<Icon icon={Check} size={14} />{/if}<span
          class="tw:max-sm:hidden"
          >{text(copyStatus === "copied" ? "copied" : "deskCopyAgent")}</span
        ><span class="tw:sm:hidden"
          >{text(copyStatus === "copied" ? "copied" : "copy")}</span
        ></Button
      >
    </div>
    <code
      class="tw:block tw:rounded-control tw:bg-muted tw:px-3 tw:py-2 tw:font-mono tw:text-xs tw:leading-5 tw:break-words tw:text-foreground tw:select-all"
      >{setup}</code
    >{#if !copyStatus}<p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
        {text("deskConnectHelp")}
      </p>{:else}<p
        role={copyStatus === "copyFailed" ? "alert" : "status"}
        class={[
          "tw:m-0 tw:text-xs",
          copyStatus === "copyFailed"
            ? "tw:text-destructive"
            : "tw:text-muted-foreground",
        ]}
      >
        {text(copyStatus === "copyFailed" ? "copyFailed" : "deskCopied")}
      </p>{/if}
  </div>{/snippet}

<!-- Where the ask goes: one line with the destination and its two buttons, the
     reason under it, and the other places as chips. -->
{#snippet suggestionCard()}{#if $view.result}{@const choices = destinations(
      $view.result,
    )}{@const selected = choices[$view.selected]!}
    <div
      data-home-suggestion
      class="tw:flex tw:flex-col tw:gap-2 tw:rounded-2xl tw:bg-card tw:p-3 tw:pl-4 tw:text-left tw:shadow-edge"
    >
      <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-x-3 tw:gap-y-2">
        <p
          aria-live="polite"
          class="tw:m-0 tw:min-w-0 tw:flex-1 tw:basis-48 tw:break-words"
        >
          <span class="tw:text-muted-foreground">{text("deskSendTo")}</span>
          <b class="tw:font-medium">{place(selected)}</b>
        </p>
        <div class="tw:flex tw:shrink-0 tw:gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            disabled={$view.busy === "send"}
            onclick={() => session.cancel()}>{text("cancel")}</Button
          ><Button
            size="sm"
            bind:ref={sendButton}
            aria-busy={$view.busy === "send" || undefined}
            disabled={$view.busy === "send"}
            onclick={() => session.send()}
            >{#if $view.busy === "send"}<Spinner size="xs" />{/if}{text(
              "send",
            )}</Button
          >
        </div>
      </div>
      {#if $view.selected === 0 && $view.result.pick && $view.result.reason}<p
          class="tw:m-0 tw:text-xs tw:leading-5 tw:text-muted-foreground"
        >
          {$view.result.reason}
        </p>{/if}
      {#if choices.length > 1}<div
          class="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:border-t tw:border-border tw:pt-2"
        >
          <span class="tw:text-xs tw:text-muted-foreground"
            >{text("deskOr")}</span
          >
          {#each choices as choice, index}{#if index !== $view.selected}<Button
                size="sm"
                variant="outline"
                disabled={!!$view.busy}
                class="tw:h-7 tw:max-w-full tw:rounded-full tw:px-3 tw:text-xs"
                onclick={() => {
                  session.select(index);
                  void tick().then(() => {
                    if (sendButton?.isConnected) sendButton.focus();
                  });
                }}><span class="tw:truncate">{place(choice)}</span></Button
              >{/if}{/each}
        </div>{/if}
    </div>{/if}
  {#if $view.error}<p
      role="alert"
      class="tw:m-0 tw:break-words tw:text-destructive"
    >
      {homeIssue(lang, $view.error)}
    </p>{/if}{/snippet}

<svelte:head><title>vibebook</title></svelte:head>
{#if $onboardingView.visible}
  <Onboarding owner={onboarding} {lang} {onlanguage} />
{:else}
  <!-- The desk home: the agent's cube, one sentence on what waits on you, the
       ask box, and what waits as a hand of cards at the foot of the screen
       (scrolling deals them into a grid). Your rooms follow the cards. -->
  <main
    bind:this={home}
    data-vb-native="home"
    data-home-layout="desk"
    data-home-dealt={dealt ? "" : undefined}
    class="tw:relative tw:min-h-full tw:overflow-x-clip tw:bg-background tw:font-sans tw:text-sm tw:leading-6 tw:text-foreground"
  >
    <!-- The first screen: everything down to the fan, which peeks at its foot. -->
    <div
      class={[
        "tw:flex tw:flex-col tw:items-center tw:px-4 tw:pt-4 tw:sm:px-8",
        waits.length &&
          "tw:min-h-[calc(100dvh-3.5rem)] tw:min-[901px]:min-h-[calc(100dvh-1rem)]",
      ]}
    >
      <div class="tw:w-full tw:max-w-xl">
        <InstallCard owner={pwa} {lang} compact />
      </div>
      <section
        class="tw:mt-[10vh] tw:flex tw:flex-col tw:items-center tw:max-sm:mt-4"
      >
        <canvas
          bind:this={cube}
          width="512"
          height="512"
          aria-hidden="true"
          class="tw:size-[200px] tw:max-sm:size-[112px]"
        ></canvas>
        {#if $account.me}{@const first =
            $account.me.name?.split(" ")[0]}<Heading
            level={1}
            class="tw:m-0 tw:mt-1 tw:text-center tw:text-4xl tw:font-medium tw:tracking-tight tw:text-balance tw:tabular-nums tw:max-sm:text-[28px] tw:max-sm:leading-9"
            >{#if waits.length}{headline}{:else}<!-- Nothing waits: a greeting and a question, the ask box answers it. -->
              <span class="tw:block"
                >{first
                  ? text("deskHello", { name: first })
                  : text("deskHelloAnon")}</span
              ><span class="tw:block tw:text-muted-foreground"
                >{text("deskQuestion")}</span
              >{/if}</Heading
          >{:else if $account.error}<Heading
            level={1}
            class="tw:m-0 tw:mt-1 tw:text-center tw:text-3xl tw:font-medium tw:tracking-tight tw:text-balance"
            >{text("deskLoadFailed")}</Heading
          >
          <!-- A known issue gets its sentence; a raw server code stays out of the way. -->
          {#if homeIssue(lang, $account.error) !== $account.error}<p
              class="tw:m-0 tw:mt-2 tw:text-muted-foreground"
              role="alert"
            >
              {homeIssue(lang, $account.error)}
            </p>{/if}
          <Button
            class="tw:mt-5"
            variant="outline"
            disabled={$account.loading}
            aria-busy={$account.loading || undefined}
            onclick={(event) => {
              if (event.currentTarget.isConnected) void personal.refresh();
            }}
            >{#if $account.loading}<Spinner size="xs" />{/if}{text(
              "retry",
            )}</Button
          >{:else}<div role="status" aria-label={text("loading")}>
            <Skeleton class="tw:mt-3 tw:h-9 tw:w-80 tw:max-w-[70vw]" />
            <Skeleton
              class="tw:mx-auto tw:mt-7 tw:h-12 tw:w-[576px] tw:max-w-[85vw] tw:rounded-full"
            />
          </div>{/if}
      </section>
      {#if $account.me}{@const me = $account.me}
        <div
          data-home-ask="desk"
          class="tw:relative tw:z-30 tw:mt-7 tw:flex tw:w-full tw:max-w-[640px] tw:flex-col tw:items-center tw:gap-3 tw:[&>[data-chat-field]]:w-full"
        >
          <!-- The room's chat box, as is. -->
          <div class="tw:w-full">
            <ChatField
              id="home-ask"
              maxlength={2000}
              label={text("ask")}
              placeholder={mobile.current
                ? text("deskAskShort")
                : text("deskAsk")}
              value={$draft.ask}
              onedit={(value) => session.edit(value)}
              onsubmit={() => void session.suggest()}
              {t}
              locale={lang === "en" ? "en-US" : "pt-BR"}
              disabled={$view.busy === "send"}
              busy={!!$view.busy}
              pending={$view.busy === "route"}
              sendDisabled={!$draft.ask.trim()}
            >
              {#snippet menu(close, trigger)}<Button
                  variant="menu"
                  role="menuitem"
                  onclick={() => {
                    close();
                    onnew(trigger ?? undefined);
                  }}>{text("new")}</Button
                ><Button
                  variant="menu"
                  role="menuitem"
                  onclick={() => {
                    close();
                    onsearch();
                  }}>{text("search")} <small>⌘K</small></Button
                >{/snippet}
            </ChatField>
          </div>
          <div class="tw:w-full">{@render suggestionCard()}</div>
          {#if !me.books.length}<!-- No rooms yet: one clear way in. -->
            <div
              data-home-first-room
              class="tw:mt-6 tw:flex tw:flex-col tw:items-center tw:gap-3 tw:text-center"
            >
              <Button
                size="lg"
                class="tw:rounded-full tw:px-6"
                onclick={(event) => {
                  if (event.currentTarget.isConnected)
                    onnew(event.currentTarget);
                }}>{text("deskFirstRoom")}</Button
              >
              <p
                class="tw:m-0 tw:max-w-sm tw:text-balance tw:text-muted-foreground"
              >
                {text("deskFirstRoomHelp")}
              </p>
            </div>{/if}
          {#if $account.agents && !$account.agents.agents.length}{@render connectAgent()}{/if}
          {#if $account.loading}<p
              role="status"
              class="tw:m-0 tw:text-xs tw:text-muted-foreground"
            >
              {text("refreshing")}
            </p>{/if}
          {#if $account.error}<p
              role="alert"
              class="tw:m-0 tw:text-xs tw:break-words tw:text-destructive"
            >
              {homeIssue(lang, $account.error)}
              <button
                type="button"
                class="tw:cursor-pointer tw:p-0 tw:text-foreground tw:underline tw:underline-offset-4"
                onclick={() => void personal.refresh()}>{text("retry")}</button
              >
            </p>{/if}
        </div>
        <!-- At the foot of the first screen: the fan peeks above the fold. -->
        <div
          class="tw:min-h-6 tw:flex-1 tw:max-[720px]:max-h-16"
          aria-hidden="true"
        ></div>
        {#if waits.length > 1 && filters.length > 1}<div
            bind:this={filterBar}
            role="group"
            aria-label={text("deskWaits")}
            data-home-filters
            class="tw:relative tw:z-30 tw:mb-4 tw:flex tw:max-w-full tw:flex-wrap tw:justify-center tw:gap-1.5 tw:px-1 tw:py-1"
          >
            {#each filters as option (option.kind)}<Button
                size="sm"
                variant={filter === option.kind ? "default" : "outline"}
                aria-pressed={filter === option.kind}
                class="tw:shrink-0 tw:rounded-full"
                onclick={() => void pick(option.kind)}
                >{option.label}<span
                  class={[
                    "tw:tabular-nums",
                    filter !== option.kind &&
                      (option.kind === "claude"
                        ? "tw:text-destructive"
                        : "tw:text-muted-foreground"),
                  ]}>{option.count}</span
                ></Button
              >{/each}
          </div>{/if}
        {#if waits.length}<nav
            bind:this={hand}
            aria-label={text("deskWaits")}
            data-home-hand
            class={dealt
              ? "tw:grid tw:min-h-[calc(100dvh-5rem)] tw:w-full tw:max-w-[1120px] tw:content-start tw:grid-cols-4 tw:gap-4 tw:max-[1200px]:grid-cols-3 tw:max-[900px]:grid-cols-2 tw:max-[720px]:grid-cols-1 tw:max-[720px]:gap-3"
              : "tw:relative tw:-mb-[148px] tw:h-[380px] tw:w-full tw:shrink-0 tw:max-[720px]:-mb-[40px] tw:max-[720px]:h-[300px]"}
          >
            {#each shown as wait, i (wait.book_id + ":" + wait.ref)}{@const room =
                me.books.find((book) => book.id === wait.book_id)}{@const task =
                wait.ref.startsWith("t")}{@const front =
                i === 0}{@const reachable =
                dealt || inFan(i, shown.length, phone.current)}<a
                href={targetHref(waitTarget(wait))}
                data-home-card={wait.ref}
                data-wait-kind={claudeWait(wait)
                  ? "claude"
                  : task
                    ? "review"
                    : "ask"}
                tabindex={reachable ? 0 : -1}
                aria-hidden={reachable ? undefined : "true"}
                class={[
                  "tw:group/card tw:flex tw:flex-col tw:gap-2 tw:overflow-hidden tw:rounded-[22px] tw:bg-card tw:px-[18px] tw:py-4 tw:text-foreground tw:no-underline tw:shadow-[0_0_0_1px_var(--vb-hairline),0_1px_2px_rgb(0_0_0/.04),0_-6px_28px_-12px_rgb(0_0_0/.18)] tw:outline-none tw:transition-shadow tw:duration-150 tw:focus-visible:ring-2 tw:focus-visible:ring-ring",
                  dealt
                    ? "tw:relative tw:min-h-[176px] tw:max-[720px]:min-h-0 tw:hover:shadow-[0_0_0_1px_var(--vb-input),0_8px_24px_-8px_rgb(0_0_0/.25)]"
                    : [
                        "tw:absolute tw:top-0 tw:right-0 tw:left-0 tw:mx-auto tw:h-[320px] tw:w-[340px] tw:origin-bottom tw:max-[720px]:h-[210px] tw:max-[720px]:w-[min(340px,calc(100%-16px))]",
                        fanClasses(i, shown.length),
                      ],
                ]}
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
                    onnavigate(waitTarget(wait));
                }}
                ><span
                  class={[
                    "tw:flex tw:flex-col tw:gap-2 tw:transition-opacity tw:duration-200",
                    !dealt && !front && "tw:opacity-35",
                  ]}
                  ><span
                    class="tw:flex tw:min-w-0 tw:items-center tw:gap-2 tw:text-xs tw:leading-5 tw:text-muted-foreground"
                    >{#if room && roomIcon(room)}<img
                        src={roomIcon(room)}
                        alt=""
                        loading="lazy"
                        class="tw:size-6 tw:shrink-0 tw:rounded-md tw:object-cover"
                      />{:else}<OrgAvatar
                        name={wait.room}
                        size="xs"
                      />{/if}<span class="tw:min-w-0 tw:truncate"
                      >{wait.room}{wait.topic ? ` › ${wait.topic}` : ""}</span
                    ></span
                  ><span
                    class="tw:flex tw:min-w-0 tw:items-center tw:gap-2 tw:text-xs tw:leading-5 tw:text-muted-foreground"
                    >{#if task}<Icon icon={Check} size={14} /><span
                        class="tw:min-w-0 tw:flex-1 tw:truncate"
                        >{text("deskTask")}</span
                      >{:else if claudeWait(wait)}<AgentMark
                        size="2xs"
                        class="tw:text-[10px]"
                      /><span
                        class="tw:min-w-0 tw:flex-1 tw:truncate tw:font-medium tw:text-destructive"
                        >{who(wait)} · {text("needsYou")}</span
                      >{:else if wait.author === "ai"}<AgentMark
                        mark="✦"
                        size="2xs"
                        class="tw:text-[10px]"
                      /><span class="tw:min-w-0 tw:flex-1 tw:truncate"
                        >{who(wait)}</span
                      >{:else}<PersonAvatar
                        size="2xs"
                        name={wait.author_name || wait.author}
                        url={personAvatar(me, wait.author)}
                      /><span class="tw:min-w-0 tw:flex-1 tw:truncate"
                        >{who(wait)}</span
                      >{/if}<span class="tw:shrink-0 tw:tabular-nums"
                      >{ago(wait.ts)}</span
                    ></span
                  ><b
                    class="tw:line-clamp-4 tw:text-[17px] tw:leading-[1.3] tw:font-medium tw:tracking-[-0.01em] tw:break-words"
                    >{plainWaitText(wait.text)}</b
                  ></span
                ></a
              >{/each}
          </nav>{/if}
      {/if}
    </div>
    <div class="tw:h-16" aria-hidden="true"></div>
  </main>
{/if}
