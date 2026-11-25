<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { AGENT_TILES, agentMark } from "../../lib/components/agent";
  import Icon from "../../lib/studio/Icon.svelte";
  import type { OnboardingStep } from "./model";
  /** The picture on top of each first-run step, drawn with the app's own pieces
   * and solid theme tokens: you, your agent meeting deco.chat, your first room. */
  let {
    step,
    email,
    avatar,
    name,
    placeholder,
  }: {
    step: OnboardingStep;
    email: string | undefined;
    avatar: number | null | undefined;
    /** What is typed in the name field, shown on the chip as you type. */
    name: string;
    placeholder: string;
  } = $props();
  type Art = "you" | "connect" | "room";
  const art = $derived.by((): Art => {
    switch (step) {
      case 1:
        return "you";
      case 2:
        return "connect";
      case 3:
        return "room";
      default: {
        const never: never = step;
        throw new Error(`Unknown onboarding step ${String(never)}`);
      }
    }
  });
</script>

<div
  data-onboarding-art={art}
  aria-hidden="true"
  class="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl bg-muted"
>
  {#if art === "you"}
    <span class="absolute top-6 left-10 size-3 rounded-full bg-brand"></span>
    <span
      class="absolute right-12 bottom-6 size-4 rounded-full bg-brand-purple-light"
    ></span>
    <span class="absolute top-8 right-20 size-2 rounded-full bg-border"></span>
    <div class="flex items-center gap-4">
      <span class="relative">
        <PersonAvatar
          size="xl"
          {email}
          version={avatar}
          class="ring-4 ring-card"
        />
        <span
          class="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full bg-card text-foreground shadow-edge"
          ><Icon icon="camera-01" size={14} /></span
        >
      </span>
      <span
        class="max-w-40 truncate rounded-full bg-brand px-4 py-1.5 text-base font-semibold text-brand-foreground shadow-edge motion-safe:animate-[card-land_420ms_cubic-bezier(0.22,1,0.36,1)_both]"
        >{name.trim() || placeholder}</span
      >
    </div>
  {:else if art === "connect"}
    <div class="flex items-center gap-3">
      <span
        class={[
          "grid size-16 place-items-center rounded-2xl text-3xl leading-none shadow-edge",
          AGENT_TILES.claude,
        ]}>{agentMark("claude")}</span
      >
      <span class="flex items-center gap-1.5">
        {#each [0, 1, 2, 3, 4] as dot (dot)}<span
            class={[
              "size-1.5 rounded-full motion-safe:animate-pulse",
              dot === 2 ? "bg-brand-purple-light" : "bg-muted-foreground",
              [
                "",
                "[animation-delay:150ms]",
                "[animation-delay:300ms]",
                "[animation-delay:450ms]",
                "[animation-delay:600ms]",
              ][dot],
            ]}
          ></span>{/each}
      </span>
      <img
        src="/favicon.svg"
        width="64"
        height="64"
        alt=""
        draggable="false"
        class="size-16 rounded-2xl shadow-edge"
      />
    </div>
  {:else}
    <div
      class="relative flex w-60 flex-col gap-2 rounded-xl bg-card p-3 shadow-edge"
    >
      <div class="flex items-center gap-2">
        <span
          class="grid size-7 place-items-center rounded-lg bg-brand text-brand-foreground"
          ><Icon icon="message-circle-01" size={14} /></span
        >
        <span class="h-2.5 w-24 rounded-full bg-foreground"></span>
      </div>
      {#each ["w-32", "w-20"] as width, index (width)}<div
          class="flex items-center gap-2"
        >
          <span
            class={[
              "size-5 rounded-full",
              index ? "bg-brand-yellow-light" : "bg-brand-purple-light",
            ]}
          ></span>
          <span class={["h-2 rounded-full bg-border", width]}></span>
        </div>{/each}
      <span
        class="absolute -top-2 -right-3 rounded-full bg-brand-purple-light px-2.5 py-0.5 text-xs font-semibold text-brand-purple-dark shadow-edge"
        >+2</span
      >
    </div>
  {/if}
</div>
