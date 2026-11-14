<script lang="ts">
  import { untrack } from "svelte";
  import type { createFireController } from "./fire";
  import type { fireCopy } from "./fireCopy";
  import Snapshot from "../../lib/ui/Snapshot.svelte";
  import Button from "../../lib/ui/Button.svelte";
  let {
    owner,
    copy,
    current,
  }: {
    owner: ReturnType<typeof createFireController>;
    copy: ReturnType<typeof fireCopy>;
    current: () => boolean;
  } = $props();
  const state = untrack(() => owner.state);
</script>

{#if $state.phase !== "idle" && $state.phase !== "complete"}{#key $state.session}<Snapshot
      value={$state.session}
      >{#snippet children(ticket)}
        <div
          data-native-fire-bar
          aria-label={copy.title}
          class="tw:mb-2 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-surface tw:border tw:border-warning tw:bg-card tw:p-2 tw:text-sm tw:text-card-foreground"
        >
          {#if $state.busy || $state.interim}<span
              aria-hidden="true"
              class="tw:size-3 tw:animate-spin tw:rounded-full tw:border-2 tw:border-border tw:border-t-primary tw:motion-reduce:animate-none"
            ></span>{/if}<span aria-hidden="true">🔥</span>
          <span class="tw:min-w-0 tw:flex-1 tw:truncate" role="status"
            >{#if $state.phase === "unconfirmed" || $state.phase === "review-unconfirmed"}{copy.unconfirmed}{:else if $state.phase === "review-pending"}{copy.review}{:else if $state.phase === "stopping"}{copy.stopping}{:else if $state.busy}{copy.applying}:
              {$state.lastText}{:else if $state.interim}… {$state.interim}{:else if $state.applied}v{$state.applied}
              {copy.version}: {$state.lastText}{:else}{copy.live}{/if}</span
          >
          {#if $state.phase === "live"}<Button
              size="sm"
              variant="ghost"
              onclick={(event) => {
                if (
                  event.currentTarget.isConnected &&
                  current() &&
                  owner.owns(ticket)
                )
                  owner.stop();
              }}>{copy.stop}</Button
            >{:else if $state.phase === "unconfirmed" || $state.phase === "review-unconfirmed"}<Button
              size="sm"
              variant="outline"
              onclick={(event) => {
                if (
                  event.currentTarget.isConnected &&
                  current() &&
                  owner.owns(ticket)
                )
                  owner.cancel();
              }}>{copy.close}</Button
            >{/if}
          {#if $state.error && $state.error !== "unconfirmed"}<p
              role="alert"
              class="tw:m-0 tw:basis-full"
            >
              {$state.error === "not-allowed"
                ? copy.denied
                : $state.error === "speech"
                  ? copy.speech
                  : copy.failed}
            </p>{/if}
        </div>
      {/snippet}</Snapshot
    >{/key}{/if}
