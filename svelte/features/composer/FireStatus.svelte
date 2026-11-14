<script lang="ts">
  import { prettyModel } from "../chat/model";
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

{#if $state.phase !== "idle" || $state.sending !== "none" || $state.error}
  {#key $state.session}<Snapshot value={$state.session}
      >{#snippet children(ticket)}
        <div
          data-native-fire-bar
          data-fire-phase={$state.phase}
          data-fire-sending={$state.sending}
          data-fire-locked={$state.locked}
          aria-label={copy.title}
          class="tw:mb-2 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-surface tw:border tw:border-warning tw:bg-card tw:p-2 tw:text-sm tw:text-card-foreground"
        >
          {#if $state.sending === "transcribing" || $state.sending === "message" || $state.phase === "switching" || $state.phase === "leaving"}<span
              aria-hidden="true"
              class="tw:size-3 tw:animate-spin tw:rounded-full tw:border-2 tw:border-border tw:border-t-primary tw:motion-reduce:animate-none"
            ></span>{/if}
          {#if $state.talking || $state.locked}<span
              data-native-fire-listening
              aria-hidden="true"
              class="tw:size-2.5 tw:shrink-0 tw:animate-pulse tw:rounded-full tw:bg-destructive tw:motion-reduce:animate-none"
            ></span>{/if}
          <span aria-hidden="true">🔥</span>
          <b class="tw:whitespace-nowrap"
            >{#if $state.locked}🔒 {copy.locked}{:else if $state.talking}{copy.talking}{:else if $state.phase === "ready"}⚡
              {prettyModel($state.model || "Haiku")}
              {copy.ready}{:else if $state.phase === "failed"}⚠ {copy.failed}{:else if $state.phase === "leaving"}{copy.leaving}{:else if $state.phase === "idle"}{copy.title}{:else}{copy.switching}{/if}</b
          >
          <span role="status" class="tw:min-w-0 tw:flex-1 tw:truncate"
            >{#if $state.sending === "transcribing"}{copy.transcribing}
              {$state.text}{:else if $state.sending === "message"}{copy.sending}{:else if $state.sending === "unconfirmed"}{copy.unconfirmed}{:else if $state.talking}{$state.text}{:else if $state.sent}{copy.sent}:
              {$state.sent}{:else if $state.phase === "ready"}{copy.hold}{:else}{$state.note}{/if}</span
          >
          {#if $state.phase !== "idle"}<Button
              size="sm"
              variant="ghost"
              onclick={(event) => {
                if (
                  event.currentTarget.isConnected &&
                  current() &&
                  owner.owns(ticket)
                )
                  owner.stop();
              }}>{copy.leave}</Button
            >{/if}
          {#if $state.error === "send-refused" || $state.sending === "unconfirmed"}
            {#key $state.intent}<Snapshot value={$state.intent}
                >{#snippet children(intent)}
                  {#if $state.error === "send-refused"}<Button
                      size="sm"
                      variant="outline"
                      onclick={(event) => {
                        if (
                          event.currentTarget.isConnected &&
                          current() &&
                          owner.owns(ticket)
                        )
                          owner.retry(intent);
                      }}>{copy.retry}</Button
                    >{/if}
                  <Button
                    size="sm"
                    variant="ghost"
                    onclick={(event) => {
                      if (
                        event.currentTarget.isConnected &&
                        current() &&
                        owner.owns(ticket)
                      )
                        owner.discard(intent);
                    }}>{copy.discard}</Button
                  >
                {/snippet}</Snapshot
              >{/key}
          {/if}
          {#if $state.error}<p role="alert" class="tw:m-0 tw:basis-full">
              {$state.error === "permission"
                ? copy.permission
                : $state.error === "unsupported"
                  ? copy.unsupported
                  : $state.error === "recording"
                    ? copy.recording
                    : $state.error === "empty"
                      ? copy.empty
                      : $state.error === "restore"
                        ? copy.restore
                        : $state.error === "unconfirmed" ||
                            $state.error === "send-refused"
                          ? copy.unconfirmed
                          : copy.failed}
            </p>{/if}
        </div>
      {/snippet}</Snapshot
    >{/key}
{/if}
