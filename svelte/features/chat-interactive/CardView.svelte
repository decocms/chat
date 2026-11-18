<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { Card, CardEl } from "../../../shared/card";
  import type { Room, Message } from "../../../shared/room";
  import type { ChatActions, ChatBridge } from "../../chatTypes";
  import Button from "../../lib/studio/Button.svelte";
  import Badge from "../../lib/studio/Badge.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import { cn } from "../../lib/studio/utils";
  import { fieldDeltaTone } from "./chartProjection";
  import CardBox from "../../lib/studio/Card.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { ArrowRight, Check, LinkExternal01 } from "../../lib/studio/icons";
  import CardChart from "./CardChart.svelte";
  import CardTable from "./CardTable.svelte";
  import { answerOf, canAnswer, inlineCardNodes } from "./model";
  import { createInteractiveSession, idleState } from "./session";
  let {
    card,
    message,
    room,
    actions,
    vb,
    readOnly = false,
  }: {
    card: Card;
    room: Room;
    vb: Pick<ChatBridge, "t">;
  } & (
    | { readOnly?: false; message: Message; actions: ChatActions }
    | {
        readOnly: true;
        message?: never;
        actions: Pick<ChatActions, "navigate" | "navigateRich" | "openApp">;
      }
  ) = $props();
  let active = true,
    status = $state(idleState()),
    expanded = $state<string | null>(null);
  const inline = $derived(inlineCardNodes(card));
  let previousCard = untrack(() => card);
  $effect(() => {
    const current = card;
    if (current !== previousCard)
      untrack(() => {
        previousCard = current;
        expanded = null;
      });
  });
  const session = untrack(() =>
    !readOnly && message
      ? createInteractiveSession(room.id, message.id, (next) => (status = next))
      : null,
  );
  $effect(() => {
    const snapshot = room;
    untrack(() => session?.sync(snapshot));
  });
  onDestroy(() => {
    active = false;
    session?.dispose();
  });
  const root = $derived(card.elements[card.root]);
  const title = $derived(
    root.type === "Card" ? root.props.title || vb.t("Tabela") : vb.t("Tabela"),
  );
  const answer = $derived(
    !readOnly && message ? answerOf(room, message) : undefined,
  );
  const actionable = $derived(
    !readOnly && !!message && canAnswer(room, message),
  );
  const busy = $derived(
    status.phase === "pending" || status.phase === "unconfirmed",
  );
  function reply(value: string, event: MouseEvent) {
    const request = "request" in actions ? actions.request : undefined;
    if (
      active &&
      !readOnly &&
      session &&
      request &&
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.isConnected &&
      actionable
    )
      void session.reply(value, request);
  }
  function navigate(url: string, event: MouseEvent) {
    if (
      !active ||
      !(event.currentTarget instanceof HTMLElement) ||
      !event.currentTarget.isConnected
    )
      return;
    const m = /^#m(\d+)$/.exec(url);
    if (m) {
      const id = Number(m[1]);
      if (Number.isSafeInteger(id)) actions.navigate(id);
    } else if (url.startsWith("#app:")) {
      const [connection, tool] = url.slice(5).split("/");
      actions.openApp?.({ connection, tool });
    } else if (url.startsWith("#e"))
      actions.navigateRich?.({ kind: "thread", id: url.slice(2) });
    else if (url.startsWith("#doc"))
      actions.navigateRich?.({ kind: "document", id: url.split(":")[1] });
  }
</script>

{#snippet draw(element: CardEl, id = card.root)}
  {#if element.type === "Card"}{@const body = element.children.filter(
      (child) => card.elements[child]?.type !== "Actions",
    )}{@const footer = element.children.filter(
      (child) => card.elements[child]?.type === "Actions",
    )}<CardBox
      size="flush"
      class="max-w-[36rem] gap-0 overflow-hidden font-sans text-sm [&_h2]:whitespace-pre-wrap [&_p]:whitespace-pre-wrap"
    >
      {#snippet child({ props })}<section {...props}>
          <!-- Title, the content, then the actions as real buttons in a footer of their own. -->
          {#if element.props.title}<header
              class="flex flex-col gap-0.5 px-4 pt-3.5 pb-1"
            >
              <h2
                class="m-0 font-sans text-[0.9375rem] leading-6 font-semibold tracking-normal"
              >
                {element.props.title}
              </h2>
              {#if element.props.subtitle}<p
                  class="m-0 text-xs leading-4 text-muted-foreground"
                >
                  {element.props.subtitle}
                </p>{/if}
            </header>{/if}
          {#if body.length}<div
              class={[
                "flex flex-col gap-3 px-4 pb-4",
                element.props.title ? "pt-2" : "pt-4",
              ]}
            >
              {#each body as id}{@render draw(card.elements[id], id)}{/each}
            </div>{/if}
          {#each footer as id}<div
              data-native-card-actions
              class="border-t border-border bg-muted/40 px-4 py-2.5"
            >
              {@render draw(card.elements[id], id)}
            </div>{/each}
        </section>{/snippet}
    </CardBox>
  {:else if element.type === "Section"}<section class="space-y-2">
      {#if element.props.title}<h5
          class="m-0 whitespace-pre-wrap font-sans text-sm font-semibold tracking-normal [font-variation-settings:normal]"
        >
          {element.props.title}
        </h5>{/if}{#each element.children as id}{@render draw(
          card.elements[id],
        )}{/each}
    </section>
  {:else if element.type === "Text"}<p
      class={[
        "m-0 whitespace-pre-wrap break-words font-sans leading-6",
        element.props.style === "bold"
          ? "font-semibold"
          : element.props.style === "muted"
            ? "text-muted-foreground"
            : element.props.style === "code"
              ? "rounded-control bg-muted p-2 font-mono text-xs"
              : "",
      ]}
    >
      {element.props.content}
    </p>
  {:else if element.type === "Fields"}<dl
      class={[
        "m-0 grid grid-cols-1 gap-x-6 gap-y-3",
        element.children.length > 1 && "md:grid-cols-2",
      ]}
    >
      {#each element.children as id}{@render draw(card.elements[id])}{/each}
    </dl>
  {:else if element.type === "Field"}<div class="flex min-w-0 flex-col gap-0.5">
      <dt
        class="whitespace-pre-wrap text-xs leading-4 font-medium text-muted-foreground"
      >
        {element.props.label}
      </dt>
      <dd class="m-0 whitespace-pre-wrap break-words leading-5">
        {element.props.value}
        {#if element.props.delta}<Badge
            variant={fieldDeltaTone(element.props.delta, element.props.good)}
            >{element.props.delta}</Badge
          >{/if}
      </dd>
      {#if element.props.trend}<small
          class="block whitespace-pre-wrap text-xs text-muted-foreground"
          >{element.props.trend}</small
        >{/if}
    </div>
  {:else if element.type === "Table"}<CardTable
      headers={element.props.headers}
      rows={element.props.rows}
      {title}
      {vb}
      inline={inline.has(id)}
      open={expanded === id}
      onOpenChange={(open) => (expanded = open ? id : null)}
    />
  {:else if element.type === "Chart"}<CardChart
      chart={element.props}
      {vb}
      inline={inline.has(id)}
      open={expanded === id}
      onOpenChange={(open) => (expanded = open ? id : null)}
    />
  {:else if element.type === "Divider"}<hr class="my-3 border-border" />
  {:else if element.type === "Image"}<img
      src={element.props.url}
      alt={element.props.alt || ""}
      loading="lazy"
      class="block max-w-full rounded-control object-contain"
    />
  {:else if element.type === "Actions"}<div class="flex flex-wrap gap-2">
      {#each element.children as id}{@render draw(card.elements[id])}{/each}
    </div>
  {:else if element.type === "Button"}{@const value =
      element.props.value || element.props.label}{#if actionable}<Button
        data-native-card-answer={value}
        class="h-auto min-h-8 whitespace-pre-wrap text-left"
        size="sm"
        variant={element.props.style === "danger"
          ? "destructive"
          : element.props.style === "primary"
            ? "default"
            : "outline"}
        disabled={busy}
        onclick={(event) => reply(value, event)}>{element.props.label}</Button
      >{:else}<span
        data-native-card-picked={answer?.text === value ? value : undefined}
        class={answer?.text === value
          ? "inline-flex items-center gap-1 whitespace-pre-wrap rounded-button border border-primary bg-primary/10 px-3 py-1.5 text-sm"
          : "inline-flex items-center whitespace-pre-wrap rounded-button border border-border px-3 py-1.5 text-sm text-muted-foreground"}
        >{#if answer?.text === value}<Icon
            icon={Check}
            size={16}
          />{/if}{element.props.label}</span
      >{/if}
  {:else if element.type === "LinkButton"}{#if element.props.url.startsWith("#")}<Button
        class="h-8 gap-1.5 whitespace-nowrap"
        size="sm"
        variant={element.props.style === "primary" ? "default" : "outline"}
        onclick={(event) => navigate(element.props.url, event)}
        >{element.props.label}<Icon icon={ArrowRight} size={14} /></Button
      >{:else}<a
        href={element.props.url}
        target="_blank"
        rel="noopener noreferrer"
        class={cn(
          buttonVariants({
            variant: element.props.style === "primary" ? "default" : "outline",
            size: "sm",
          }),
          "h-8 gap-1.5 whitespace-nowrap no-underline",
        )}>{element.props.label}<Icon icon={LinkExternal01} size={14} /></a
      >{/if}
  {/if}
{/snippet}
<div
  data-native-card
  data-native-card-readonly={readOnly || undefined}
  data-vb-native
  class="space-y-2 font-sans text-sm text-foreground"
>
  {@render draw(card.elements[card.root])}
  {#if status.phase !== "idle"}<p
      role={status.phase === "error" ? "alert" : "status"}
      class="m-0 text-xs text-muted-foreground"
    >
      {status.phase === "pending"
        ? vb.t("Enviando…")
        : status.phase === "unconfirmed"
          ? vb.t(
              "Ainda sem confirmação. Confira a sala antes de enviar novamente.",
            )
          : status.error}
    </p>{/if}
</div>
