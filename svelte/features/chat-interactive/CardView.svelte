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
  {#if element.type === "Card"}<CardBox
      class="tw:font-sans tw:text-sm tw:[&_h2]:whitespace-pre-wrap tw:[&_p]:whitespace-pre-wrap"
    >
      {#snippet child({ props })}<section {...props}>
          {#if element.props.title}<div class="tw:space-y-1">
              <h2
                class="tw:m-0 tw:font-sans tw:text-base tw:leading-6 tw:font-semibold tw:tracking-normal"
              >
                {element.props.title}
              </h2>
              {#if element.props.subtitle}<p
                  class="tw:m-0 tw:text-sm tw:leading-5 tw:text-muted-foreground"
                >
                  {element.props.subtitle}
                </p>{/if}
            </div>{/if}{#each element.children as id}{@render draw(
              card.elements[id],
              id,
            )}{/each}
        </section>{/snippet}
    </CardBox>
  {:else if element.type === "Section"}<section class="tw:space-y-2">
      {#if element.props.title}<h5
          class="tw:m-0 tw:whitespace-pre-wrap tw:font-sans tw:text-sm tw:font-semibold tw:tracking-normal tw:[font-variation-settings:normal]"
        >
          {element.props.title}
        </h5>{/if}{#each element.children as id}{@render draw(
          card.elements[id],
        )}{/each}
    </section>
  {:else if element.type === "Text"}<p
      class={[
        "tw:m-0 tw:whitespace-pre-wrap tw:break-words tw:font-sans tw:leading-6",
        element.props.style === "bold"
          ? "tw:font-semibold"
          : element.props.style === "muted"
            ? "tw:text-muted-foreground"
            : element.props.style === "code"
              ? "tw:rounded-control tw:bg-muted tw:p-2 tw:font-mono tw:text-xs"
              : "",
      ]}
    >
      {element.props.content}
    </p>
  {:else if element.type === "Fields"}<dl
      class="tw:m-0 tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2"
    >
      {#each element.children as id}{@render draw(card.elements[id])}{/each}
    </dl>
  {:else if element.type === "Field"}<div class="tw:min-w-0">
      <dt class="tw:whitespace-pre-wrap tw:text-xs tw:text-muted-foreground">
        {element.props.label}
      </dt>
      <dd class="tw:m-0 tw:whitespace-pre-wrap tw:break-words tw:font-medium">
        {element.props.value}
        {#if element.props.delta}<Badge
            variant={fieldDeltaTone(element.props.delta, element.props.good)}
            >{element.props.delta}</Badge
          >{/if}
      </dd>
      {#if element.props.trend}<small
          class="tw:block tw:whitespace-pre-wrap tw:text-xs tw:text-muted-foreground"
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
  {:else if element.type === "Divider"}<hr class="tw:my-3 tw:border-border" />
  {:else if element.type === "Image"}<img
      src={element.props.url}
      alt={element.props.alt || ""}
      loading="lazy"
      class="tw:block tw:max-w-full tw:rounded-control tw:object-contain"
    />
  {:else if element.type === "Actions"}<div
      class="tw:flex tw:flex-wrap tw:gap-2"
    >
      {#each element.children as id}{@render draw(card.elements[id])}{/each}
    </div>
  {:else if element.type === "Button"}{@const value =
      element.props.value || element.props.label}{#if actionable}<Button
        data-native-card-answer={value}
        class="tw:h-auto tw:min-h-8 tw:whitespace-pre-wrap tw:text-left"
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
          ? "tw:inline-flex tw:items-center tw:gap-1 tw:whitespace-pre-wrap tw:rounded-button tw:border tw:border-primary tw:bg-primary/10 tw:px-3 tw:py-1.5 tw:text-sm"
          : "tw:inline-flex tw:items-center tw:whitespace-pre-wrap tw:rounded-button tw:border tw:border-border tw:px-3 tw:py-1.5 tw:text-sm tw:text-muted-foreground"}
        >{#if answer?.text === value}<Icon
            icon={Check}
            size={16}
          />{/if}{element.props.label}</span
      >{/if}
  {:else if element.type === "LinkButton"}{#if element.props.url.startsWith("#")}<Button
        class={element.props.style === "primary"
          ? "tw:h-auto tw:min-h-8 tw:whitespace-pre-wrap tw:text-left"
          : "tw:h-auto tw:min-h-8 tw:whitespace-pre-wrap tw:text-left tw:text-foreground tw:underline tw:decoration-current/35 tw:underline-offset-4 tw:hover:decoration-current"}
        size="sm"
        variant={element.props.style === "primary" ? "default" : "link"}
        onclick={(event) => navigate(element.props.url, event)}
        >{element.props.label}<Icon icon={ArrowRight} size={16} /></Button
      >{:else}<a
        href={element.props.url}
        target="_blank"
        rel="noopener noreferrer"
        class={cn(
          buttonVariants({
            variant: element.props.style === "primary" ? "default" : "link",
            size: "sm",
          }),
          "tw:h-auto tw:min-h-8 tw:whitespace-pre-wrap tw:text-left",
          element.props.style !== "primary" &&
            "tw:text-foreground tw:underline tw:decoration-current/35 tw:underline-offset-4 tw:hover:decoration-current",
        )}>{element.props.label}<Icon icon={LinkExternal01} size={16} /></a
      >{/if}
  {/if}
{/snippet}
<div
  data-native-card
  data-native-card-readonly={readOnly || undefined}
  data-vb-native
  class="tw:space-y-2 tw:font-sans tw:text-sm tw:text-foreground"
>
  {@render draw(card.elements[card.root])}
  {#if status.phase !== "idle"}<p
      role={status.phase === "error" ? "alert" : "status"}
      class="tw:m-0 tw:text-xs tw:text-muted-foreground"
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
