<script lang="ts">
  import { onDestroy, type Snippet } from "svelte";
  import type { RichActions, RichNode, SafeAttributes } from "./types";
  import { HTML_NS } from "./allowlist";
  import Icon from "../../lib/studio/Icon.svelte";
  import { hasMissingFileReference } from "./fileIndex";
  import AppLinkChip from "./AppLinkChip.svelte";
  import type { Room } from "../../../shared/room";
  let {
    nodes,
    actions,
    taskSlot,
    appSlot,
    appKey,
    cardSource,
    cardSlot,
    room = null,
    t = (text: string) => text,
  }: {
    nodes: readonly RichNode[];
    actions: RichActions;
    /** The open room: a chip for a link to one of its messages or threads needs no request. */
    room?: Room | null;
    t?: (text: string) => string;
    taskSlot?: Snippet;
    appSlot?: Snippet<[number]>;
    appKey?(slot: number): string;
    cardSource?(node: RichNode): string | null;
    cardSlot?: Snippet<[string, RichNode]>;
  } = $props();
  let active = true;
  onDestroy(() => {
    active = false;
  });
  const missingFile = $derived(hasMissingFileReference(nodes));
  function key(node: RichNode, index: number): string {
    const keys: string[] = [];
    function collect(node: RichNode) {
      if (
        node.kind === "element" &&
        node.documentAppSlot !== undefined &&
        appKey
      )
        keys.push(appKey(node.documentAppSlot));
      else if ("children" in node) node.children.forEach(collect);
    }
    if (appKey) collect(node);
    return keys.length ? "app:" + JSON.stringify(keys) : "node:" + index;
  }
  $effect(() => {
    if (active && missingFile) actions.ensureFileIndex?.();
  });
  const voidTags = new Set([
    "img",
    "area",
    "br",
    "col",
    "hr",
    "source",
    "track",
    "wbr",
  ]);
  function elementClass(tag: string, namespace: string, attrs: SafeAttributes) {
    if (namespace !== HTML_NS) return tag === "svg" ? "max-w-full" : "";
    if (/^h[1-6]$/.test(tag))
      return [
        "my-3 font-sans font-semibold tracking-normal [font-variation-settings:normal] [font-feature-settings:normal]",
        tag === "h1"
          ? "text-xl leading-7"
          : tag === "h2"
            ? "text-lg leading-6"
            : "text-base leading-6",
      ];
    if (tag === "img")
      return "my-3 max-h-[80vh] max-w-full rounded-control object-contain";
    if (tag === "p") return "my-2 font-sans tracking-normal leading-6";
    if (tag === "pre")
      return "my-3 max-w-full overflow-x-auto whitespace-pre rounded-control bg-muted p-3 font-mono text-xs leading-5 focus-visible:outline-2 focus-visible:outline-ring";
    // Inline code has a background, as in Slack and Discord: a monospace font alone is hard to see. In a code block the
    // `pre` already has the background.
    if (tag === "code" || tag === "kbd" || tag === "samp")
      return "rounded-sm bg-muted px-1 py-0.5 font-mono text-xs in-[pre]:rounded-none in-[pre]:bg-transparent in-[pre]:p-0";
    if (tag === "blockquote")
      return "my-3 border-l-2 border-border pl-3 text-muted-foreground";
    if (tag === "ul") return "my-2 list-disc space-y-1 pl-5";
    if (tag === "ol") return "my-2 list-decimal space-y-1 pl-5";
    if (tag === "table") return "my-3 w-full border-collapse font-sans text-sm";
    if (tag === "td" || tag === "th")
      return [
        "border border-border px-3 py-2 align-top",
        attrs.align === "center"
          ? "text-center"
          : attrs.align === "right"
            ? "text-right"
            : "text-left",
        tag === "th" ? "font-semibold" : "",
      ];
    if (tag === "details")
      return "my-2 rounded-control border border-border p-3";
    if (tag === "summary")
      return "cursor-pointer rounded-control font-medium focus-visible:outline-2 focus-visible:outline-ring";
    if (tag === "hr") return "my-4 border-border";
    if (tag === "strong" || tag === "b") return "font-bold";
    // A link is blue with no underline, so an underline is the text's color.
    if (tag === "u") return "underline decoration-1 underline-offset-2";
    if (tag === "small") return "text-xs";
    if (tag === "audio" || tag === "video") return "max-w-full";
    return "";
  }
  function open(
    event: MouseEvent | KeyboardEvent,
    node: Extract<RichNode, { kind: "link" }>,
  ) {
    if (
      !active ||
      !(event.currentTarget instanceof Element) ||
      !event.currentTarget.isConnected
    ) {
      event.preventDefault();
      return;
    }
    if (
      ("button" in event && event.button !== 0) ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const target = node.target;
    if (target.kind === "message") {
      event.preventDefault();
      event.stopPropagation();
      actions.navigate(target.id);
    } else if (target.kind === "thread" || target.kind === "document") {
      if (actions.navigateRich) {
        event.preventDefault();
        event.stopPropagation();
        actions.navigateRich({ kind: target.kind, id: target.id });
      }
    } else if (target.kind === "app") {
      if (actions.openAppLink) {
        event.preventDefault();
        event.stopPropagation();
        actions.openAppLink(target.link);
      }
    } else if (target.kind === "file") {
      if (target.attachment) {
        event.preventDefault();
        event.stopPropagation();
        actions.openFile(target.attachment);
      } else if (actions.openFileReference) {
        event.preventDefault();
        event.stopPropagation();
        actions.openFileReference(target.file);
      }
    }
  }
  const external = (node: Extract<RichNode, { kind: "link" }>) =>
    node.target.kind === "github" ||
    (node.target.kind === "url" && node.target.external);
</script>

{#snippet content(items: readonly RichNode[])}
  {#each items as node, index (key(node, index))}
    {@const documentCard = cardSource?.(node) ?? null}
    {#if node.kind === "text"}{node.text}
    {:else if node.kind === "mention"}
      {@const tone = node.mine
        ? "rounded-sm bg-brand-purple/25 px-1 font-semibold text-brand-purple-text"
        : "rounded-sm bg-brand-purple/12 px-1 font-medium text-brand-purple-text"}
      {#if node.who !== "ai" && actions.openPerson}
        {@const person = node.who}
        <!-- A person's mention opens your DM with them (Gimenes #5298). -->
        <span
          data-rich-mention={person}
          title={person}
          role="link"
          tabindex="0"
          onclick={(event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            actions.openPerson?.(person);
          }}
          onkeydown={(event: KeyboardEvent) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            actions.openPerson?.(person);
          }}
          class={[tone, "cursor-pointer hover:underline"]}>{node.text}</span
        >
      {:else}<span
          data-rich-mention={node.who}
          title={node.who === "ai" ? "@vibe" : node.who}
          class={tone}>{node.text}</span
        >{/if}
    {:else if node.kind === "link"}
      {#if node.namespace !== HTML_NS}<svelte:element
          this={"a"}
          role="link"
          tabindex="0"
          onkeydown={(event: KeyboardEvent) => {
            if (event.key === "Enter") open(event, node);
          }}
          xmlns={node.namespace}
          href={node.target.href}
          title={node.title}
          target={external(node) ? "_blank" : undefined}
          rel={external(node) ? "noopener noreferrer nofollow ugc" : undefined}
          onclick={(event: MouseEvent) => open(event, node)}
          >{@render content(node.children)}</svelte:element
        >
      {:else if node.target.kind === "app" && node.target.chip}{@const target =
          node.target}{#snippet plain()}<a
            href={target.href}
            data-rich-link="app"
            onclick={(event) => open(event, node)}
            class="rounded-sm text-link no-underline decoration-dashed decoration-1 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >{@render content(node.children)}</a
          >{/snippet}<AppLinkChip
          link={target.link}
          href={target.href}
          {room}
          {t}
          onopen={(event) => open(event, node)}
          {plain}
        />
      {:else}<a
          href={node.target.href}
          title={node.target.kind === "file"
            ? node.target.file.name
            : node.target.kind === "github"
              ? node.target.label || undefined
              : node.title}
          target={external(node) ? "_blank" : undefined}
          rel={external(node) ? "noopener noreferrer nofollow ugc" : undefined}
          onclick={(event) => open(event, node)}
          data-rich-link={node.target.kind}
          class={node.target.kind === "file" || node.target.kind === "github"
            ? "inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 align-middle text-xs font-medium text-foreground underline decoration-current/35 underline-offset-4 hover:decoration-current underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            : // Blue, no underline; a dashed one on hover (Valls).
              "rounded-sm text-link no-underline decoration-dashed decoration-1 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"}
        >
          {#if node.target.kind === "github"}<svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="currentColor"
              class="size-4 shrink-0"
              ><path
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
              ></path></svg
            >{#if node.target.label}{node.target.label}{:else}{@render content(
                node.children,
              )}{/if}
          {:else if node.target.kind === "file"}<Icon
              icon="file-02"
              size={16}
            /><span class="min-w-0 break-words">{node.target.file.name}</span
            >{#if node.target.version}<small class="text-muted-foreground"
                >v{node.target.version}</small
              >{/if}
          {:else}{@render content(node.children)}{/if}
        </a>{/if}
    {:else if documentCard !== null && cardSlot}{@render cardSlot(
        documentCard,
        node,
      )}
    {:else if node.documentTaskSlot}{@render taskSlot?.()}
    {:else if node.documentAppSlot !== undefined && appSlot}{@render appSlot(
        node.documentAppSlot,
      )}
    {:else if node.namespace === HTML_NS && voidTags.has(node.tag)}<svelte:element
        this={node.tag}
        xmlns={node.namespace}
        {...node.attrs}
        class={elementClass(node.tag, node.namespace, node.attrs)}
      />
    {:else}<svelte:element
        this={node.tag}
        xmlns={node.namespace}
        {...node.attrs}
        data-code-language={node.language}
        tabindex={node.namespace === HTML_NS && node.tag === "pre"
          ? 0
          : undefined}
        class={elementClass(node.tag, node.namespace, node.attrs)}
        >{#if node.task !== undefined}<span
            aria-hidden="true"
            class="mr-1 font-mono">{node.task ? "☑" : "☐"}</span
          >{/if}{@render content(node.children)}</svelte:element
      >{/if}
  {/each}
{/snippet}
{@render content(nodes)}
