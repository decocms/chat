<script lang="ts">
  import { onDestroy } from "svelte";
  import { connectPrompt } from "./model";
  import { agentText } from "./copy";
  import Button from "../../lib/studio/Button.svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  let {
    origin,
    roomId,
    lang = "pt",
    waiting = true,
    current = () => true,
    intro = true,
  }: {
    origin: string;
    roomId?: string;
    lang?: "pt" | "en";
    waiting?: boolean;
    current?: () => boolean;
    intro?: boolean;
  } = $props();
  const text = (key: Parameters<typeof agentText>[1]) => agentText(lang, key);
  let notice = $state("");
  let active = true,
    ticket = 0;
  $effect(() => {
    void origin;
    void roomId;
    notice = "";
    ticket++;
  });
  async function copy(value: string) {
    if (!active || !current()) return;
    const own = ++ticket;
    try {
      await navigator.clipboard.writeText(value);
      if (active && current() && own === ticket) notice = text("copied");
    } catch {
      if (active && current() && own === ticket) notice = text("copyFailed");
    }
  }
  onDestroy(() => {
    active = false;
    ticket++;
  });
</script>

<section
  data-native-agent-setup
  class="space-y-3 rounded-surface border border-border bg-card p-4 text-card-foreground"
>
  {#if intro}<Heading level={3}
      >{text(roomId ? "roomConnectTitle" : "connectTitle")}</Heading
    >
    <p class="m-0 text-sm leading-6 text-muted-foreground">
      {text("connectBody")}
    </p>
  {/if}<code
    class="block select-text break-words rounded-control bg-muted p-3 font-mono text-xs"
    >{connectPrompt(origin, roomId)}</code
  ><Button
    onclick={(event) => {
      if (active && event.currentTarget.isConnected)
        void copy(connectPrompt(origin, roomId));
    }}>{text("copy")}</Button
  >
  {#if notice}<p role="status" class="m-0 text-sm text-muted-foreground">
      {notice}
    </p>{/if}
  {#if waiting}<p role="status" class="m-0 text-xs text-muted-foreground">
      {text("waiting")}
    </p>{/if}
  <details class="text-sm leading-6">
    <summary
      class="cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-ring"
      >{text("alternatives")}</summary
    >
    <div class="space-y-2 pt-2">
      <p class="m-0">
        <strong>Claude.ai:</strong>
        {text("connector")}
        <code class="select-text break-all font-mono">{origin}/mcp</code>
        <Button
          variant="ghost"
          size="sm"
          onclick={() => void copy(`${origin}/mcp`)}>{text("copy")}</Button
        >
      </p>
      <p class="m-0">
        {text("codeConnector")}
        <code class="select-text break-all font-mono"
          >claude mcp add --transport http vibebook {origin}/mcp</code
        >
        <Button
          variant="ghost"
          size="sm"
          onclick={() =>
            void copy(`claude mcp add --transport http vibebook ${origin}/mcp`)}
          >{text("copy")}</Button
        >
      </p>
      <a
        href="/llms.txt"
        target="_blank"
        rel="noopener noreferrer"
        class="text-foreground underline decoration-current/35 underline-offset-4 hover:decoration-current"
        >{text("fullGuide")}</a
      >
    </div>
  </details>
</section>
