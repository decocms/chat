<script lang="ts" module>
  export const layouts = { "send-states": "padded" };
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "../../../lib/studio/Button.svelte";
  import Composer from "../../../lib/studio/Composer.svelte";
  import ComposerAttachment from "../../../lib/studio/ComposerAttachment.svelte";
  import ComposerAttachments from "../../../lib/studio/ComposerAttachments.svelte";
  import ComposerContext from "../../../lib/studio/ComposerContext.svelte";
  import ComposerDropZone from "../../../lib/studio/ComposerDropZone.svelte";
  import ComposerFooter from "../../../lib/studio/ComposerFooter.svelte";
  import ComposerGroup from "../../../lib/studio/ComposerGroup.svelte";
  import ComposerInput from "../../../lib/studio/ComposerInput.svelte";
  import ComposerMode from "../../../lib/studio/ComposerMode.svelte";
  import ComposerModel from "../../../lib/studio/ComposerModel.svelte";
  import ComposerRecording from "../../../lib/studio/ComposerRecording.svelte";
  import ComposerSend from "../../../lib/studio/ComposerSend.svelte";
  import ComposerSuggestion from "../../../lib/studio/ComposerSuggestion.svelte";
  import ComposerSuggestions from "../../../lib/studio/ComposerSuggestions.svelte";
  import ComposerToolbar from "../../../lib/studio/ComposerToolbar.svelte";
  import ComposerTray from "../../../lib/studio/ComposerTray.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";
  import IconButton from "../../../lib/studio/IconButton.svelte";
  import TooltipProvider from "../../../lib/studio/TooltipProvider.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const PHOTO =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23efecff'/><circle cx='26' cy='14' r='5' fill='%23a595ff'/><path d='M0 40 L14 20 L26 32 L32 26 L40 34 L40 40Z' fill='%23151042'/></svg>";
  const LEVELS = [
    0.2, 0.35, 0.5, 0.8, 0.6, 0.4, 0.7, 0.9, 0.5, 0.3, 0.45, 0.65, 0.85, 0.6,
    0.35, 0.25, 0.5, 0.75, 0.55, 0.3, 0.2, 0.4, 0.6, 0.45, 0.3, 0.2, 0.15, 0.1,
  ];
  const ROWS = ["Send", "Mode", "Context"] as const;
  const CONTEXT = [0.12, 0.62, 0.86, 0.97];
  const noop = () => {};
</script>

{#snippet toolbar(start?: Snippet, send?: Snippet)}
  <ComposerToolbar>
    <ComposerGroup>
      <IconButton label="Add files, tools and modes" variant="ghost">
        <Icon icon="plus" />
      </IconButton>
      {@render start?.()}
    </ComposerGroup>
    <ComposerGroup>
      <ComposerModel>
        {#snippet icon()}<Icon icon="zap" />{/snippet}
        Smart
      </ComposerModel>
      <IconButton label="Voice input">
        <Icon icon="microphone-01" />
      </IconButton>
      {#if send}{@render send()}{:else}<ComposerSend label="Send" />{/if}
    </ComposerGroup>
  </ComposerToolbar>
{/snippet}

{#snippet sendIdle()}<ComposerSend label="Send" state="idle" />{/snippet}
{#snippet planIcon()}<Icon icon="book-open-01" />{/snippet}
{#snippet researchIcon()}<Icon icon="telescope" />{/snippet}
{#snippet webIcon()}<Icon icon="globe-02" />{/snippet}
{#snippet imageIcon()}<Icon icon="image-01" />{/snippet}

{#snippet modes()}
  <ComposerMode tone="agent" icon={planIcon} dismissLabel="Turn off plan mode"
    >Plan</ComposerMode
  >
  <ComposerMode
    tone="info"
    icon={researchIcon}
    dismissLabel="Turn off deep research">Deep research</ComposerMode
  >
  <ComposerContext value={0.38} aria-label="Context used" />
{/snippet}
{#snippet context()}
  <ComposerContext value={0.86} aria-label="Context used" />
{/snippet}
{#snippet stop()}
  <ComposerSend label="Stop" state="streaming" />
{/snippet}
{#snippet task()}
  <Button size="sm" variant="secondary" aria-pressed="true">Task</Button>
{/snippet}
{#snippet startTask()}
  <ComposerSend label="Start task">Start task</ComposerSend>
{/snippet}

<TooltipProvider>
  <div class="w-[34rem] leading-[1.5]">
    {#if story === "default"}
      <Composer>
        <ComposerInput
          placeholder="Ask anything, @ to mention, / for prompts"
        />
        {@render toolbar(undefined, sendIdle)}
      </Composer>
    {:else if story === "with-attachments"}
      <Composer>
        <ComposerAttachments>
          <ComposerAttachment
            name="Q3 campaign brief.pdf"
            meta="PDF · 2.4 MB"
            onRemove={noop}
            removeLabel="Remove Q3 campaign brief.pdf"
          />
          <ComposerAttachment
            name="Banner"
            src={PHOTO}
            onRemove={noop}
            removeLabel="Remove Banner"
          />
        </ComposerAttachments>
        <ComposerInput value="Turn this brief into three banner options" />
        {@render toolbar()}
      </Composer>
    {:else if story === "modes"}
      <Composer>
        <ComposerInput
          value="Compare our prices with the top three competitors"
        />
        {@render toolbar(modes)}
      </Composer>
    {:else if story === "streaming"}
      <div>
        <ComposerTray>
          <div
            class="text-muted-foreground flex items-center gap-2 px-2 py-1 text-xs"
          >
            <Icon icon="check-circle" class="text-success size-3.5" />
            <span class="flex-1">Building the banner · 3 of 5</span>
          </div>
          <div
            class="flex items-center gap-2 rounded-[0.625rem] px-2 py-1 text-xs"
          >
            <Icon
              icon="corner-down-right"
              class="text-muted-foreground size-3.5"
            />
            <span class="flex-1 truncate"
              >Also make a square version for Instagram</span
            >
            <Button size="xs" variant="ghost">Send now</Button>
            <IconButton label="Remove from queue">
              <Icon icon="trash-01" />
            </IconButton>
          </div>
        </ComposerTray>
        <Composer>
          <ComposerInput placeholder="Queue a follow-up" />
          {@render toolbar(context, stop)}
        </Composer>
      </div>
    {:else if story === "recording"}
      <Composer>
        <ComposerInput disabled placeholder="Listening…" />
        <ComposerRecording
          levels={LEVELS}
          cancelLabel="Cancel recording"
          confirmLabel="Use transcription"
        />
      </Composer>
    {:else if story === "drop-files"}
      <Composer>
        <ComposerInput placeholder="Ask anything" />
        {@render toolbar()}
        <ComposerDropZone>Drop files to attach</ComposerDropZone>
      </Composer>
    {:else if story === "mentions"}
      <div class="flex flex-col gap-2">
        <ComposerSuggestions class="mx-3">
          <ComposerSuggestion active title="Mobile conversion" meta="Goal">
            {#snippet icon()}<Icon icon="target-04" />{/snippet}
          </ComposerSuggestion>
          <ComposerSuggestion title="Q3 campaign brief.pdf" meta="File">
            {#snippet icon()}<Icon icon="file-02" />{/snippet}
          </ComposerSuggestion>
          <ComposerSuggestion title="Storefront" meta="Project">
            {#snippet icon()}<Icon icon="globe-02" />{/snippet}
          </ComposerSuggestion>
        </ComposerSuggestions>
        <Composer>
          <ComposerInput value="How is @mob" />
          {@render toolbar()}
        </Composer>
      </div>
    {:else if story === "start-task"}
      <Composer>
        <ComposerInput value="Review every product page for missing alt text" />
        {@render toolbar(task, startTask)}
      </Composer>
    {:else if story === "with-footer"}
      <div>
        <Composer>
          <ComposerInput placeholder="Ask anything" />
          {@render toolbar(undefined, sendIdle)}
        </Composer>
        <ComposerFooter>
          <Icon icon="stars-01" />
          <span class="flex-1"
            >Connect your tools so the agent can act on them</span
          >
          <Button size="xs" variant="ghost">Connect</Button>
        </ComposerFooter>
      </div>
    {:else if story === "compact"}
      <Composer size="compact">
        <IconButton label="Add files">
          <Icon icon="plus" />
        </IconButton>
        <ComposerInput placeholder="Ask about this file" />
        <ComposerToolbar>
          <ComposerGroup>
            <IconButton label="Voice input">
              <Icon icon="microphone-01" />
            </IconButton>
            <ComposerSend label="Send" />
          </ComposerGroup>
        </ComposerToolbar>
      </Composer>
    {:else if story === "send-states"}
      <Matrix
        columns={["Nothing typed", "Ready", "Streaming", "With label"]}
        rows={ROWS}
      >
        {#snippet cell(row, index)}
          {#if row === "Send"}
            {#if index === 0}
              <ComposerSend label="Send" state="idle" />
            {:else if index === 1}
              <ComposerSend label="Send" />
            {:else if index === 2}
              <ComposerSend label="Stop" state="streaming" />
            {:else}
              <ComposerSend label="Start task">Start task</ComposerSend>
            {/if}
          {:else if row === "Mode"}
            {#if index === 0}
              <ComposerMode
                tone="agent"
                icon={planIcon}
                dismissLabel="Turn off plan mode">Plan</ComposerMode
              >
            {:else if index === 1}
              <ComposerMode
                tone="info"
                icon={webIcon}
                dismissLabel="Turn off web search">Web search</ComposerMode
              >
            {:else if index === 2}
              <ComposerMode
                tone="highlight"
                icon={imageIcon}
                dismissLabel="Turn off create image">Create image</ComposerMode
              >
            {:else}
              <span></span>
            {/if}
          {:else}
            <ComposerContext
              value={CONTEXT[index] ?? 0}
              aria-label="Context used"
            />
          {/if}
        {/snippet}
      </Matrix>
    {/if}
  </div>
</TooltipProvider>
