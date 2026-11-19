<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import TitledDialog from "../../lib/components/TitledDialog.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import { TINTS } from "../../../shared/schemas";
  import { homeText, homeIssue, type HomeLanguage } from "../home/copy";
  import { roomIcon, type RoomSummary } from "../home/model";
  import { roomIconPng } from "../rooms/images";
  import RoomMark from "../room-sidebar/RoomMark.svelte";
  import SearchPalette from "./SearchPalette.svelte";
  import type {
    NavigationDialogOwners,
    NavigationDialogIntent,
  } from "./presentation";
  import type { AppNavigationSession } from "./controller";
  let {
    controller,
    lang,
    presentation,
    fallback,
  }: {
    controller: AppNavigationSession;
    lang: HomeLanguage;
    presentation: NavigationDialogOwners;
    fallback(): HTMLElement | null;
  } = $props();
  const bindings = $derived(presentation.bindings);
  const openings = $derived(
    Object.values($bindings)
      .filter((intent): intent is NavigationDialogIntent => intent !== null)
      .sort((a, b) => a.revision - b.revision),
  );
  const current = (intent: NavigationDialogIntent) => presentation.owns(intent);
  const focusBack = (intent: NavigationDialogIntent) =>
    presentation.returnFocus(intent, fallback());
  const personal = $derived(controller.personal.state),
    draft = $derived(controller.personal.draft),
    nav = $derived(controller.state),
    mutations = $derived(controller.rooms.state),
    creator = $derived(controller.creator.state);
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  const settingsIdentity = $derived($bindings.settings),
    renameIdentity = $derived($bindings.rename);
  const selectedRoom = $derived(
    $personal.me?.books.find((room) => room.id === $nav.settingsId),
  );
  const archiveRoom = $derived(
    $personal.me?.books.find((room) => room.id === $nav.archiveId),
  );
  const renameRoom = $derived(
    $personal.me?.books.find((room) => room.id === $nav.renameId),
  );
  let createInput = $state<HTMLTextAreaElement | null>(null),
    archiveCancel = $state<HTMLButtonElement | null>(null),
    renameInput = $state<HTMLInputElement | null>(null);
  let mounted = false,
    imageSequence = 0,
    imageBusy = $state(false),
    imageError = $state("");
  $effect(() => {
    void settingsIdentity;
    void renameIdentity;
    imageSequence++;
    imageBusy = false;
    imageError = "";
  });
  onMount(() => {
    mounted = true;
  });
  onDestroy(() => {
    mounted = false;
    imageSequence++;
  });
  /** The room the settings or the rename dialog edits. */
  const dialogRoom = (intent: NavigationDialogIntent) =>
    intent.kind === "rename" ? $nav.renameId : $nav.settingsId;
  async function upload(
    event: Event & { currentTarget: EventTarget & HTMLInputElement },
    intent: NavigationDialogIntent,
  ) {
    const input = event.currentTarget,
      file = input.files?.[0],
      id = dialogRoom(intent);
    input.value = "";
    if (!current(intent) || !mounted || !input.isConnected || !file || !id)
      return;
    const ticket = ++imageSequence,
      identity = $personal.identityRevision;
    imageBusy = true;
    imageError = "";
    try {
      const image = await roomIconPng(file);
      if (
        current(intent) &&
        mounted &&
        ticket === imageSequence &&
        identity === $personal.identityRevision &&
        input.isConnected &&
        dialogRoom(intent) === id
      )
        await controller.rooms.icon(id, image);
    } catch (error) {
      if (
        current(intent) &&
        mounted &&
        ticket === imageSequence &&
        identity === $personal.identityRevision
      )
        imageError = error instanceof Error ? error.message : "network";
    } finally {
      if (
        current(intent) &&
        mounted &&
        ticket === imageSequence &&
        identity === $personal.identityRevision
      )
        imageBusy = false;
    }
  }
</script>

<!-- The room's icon: a preview, change and remove. The settings and the rename dialogs share it. -->
{#snippet iconField(room: RoomSummary, intent: NavigationDialogIntent)}
  {@const pending = !!$mutations.pending[`icon:${room.id}`]}
  {@const inputId =
    intent.kind === "settings" ? "room-icon" : `room-icon-${intent.kind}`}
  <div class="space-y-2">
    <div class="flex flex-wrap items-center gap-3">
      <RoomMark title={room.title ?? ""} src={roomIcon(room)} size="lg" />
      <Button
        variant="outline"
        size="sm"
        disabled={imageBusy || pending}
        aria-busy={imageBusy || pending || undefined}
        onclick={(event) => {
          if (current(intent) && event.currentTarget.isConnected)
            document.getElementById(inputId)?.click();
        }}
        >{#if imageBusy || pending}<Spinner size="xs" />{/if}{text(
          "icon",
        )}</Button
      >{#if room.icon}<Button
          variant="ghost"
          size="sm"
          disabled={imageBusy || pending}
          onclick={(event) => {
            if (current(intent) && event.currentTarget.isConnected)
              controller.rooms.icon(room.id, null);
          }}>{text("removeIcon")}</Button
        >{/if}<input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,.ico"
        aria-label={text("icon")}
        class="sr-only"
        disabled={imageBusy || pending}
        onchange={(event) => upload(event, intent)}
      />
    </div>
    {#if $mutations.issues[`icon:${room.id}`]}<p
        role="alert"
        class="break-words text-destructive"
      >
        {homeIssue(lang, $mutations.issues[`icon:${room.id}`]!)}
      </p>{/if}{#if imageError}<p
        role="alert"
        class="break-words text-destructive"
      >
        {homeIssue(lang, imageError)}
      </p>{/if}
  </div>
{/snippet}

{#each openings as opening (opening.revision)}<Snapshot value={opening}
    >{#snippet children(intent)}
      {#if intent.kind === "search"}
        <SearchPalette
          search={controller.search}
          me={$personal.me}
          {lang}
          live={() => current(intent)}
          returnFocus={() => focusBack(intent)}
        />
      {:else if intent.kind === "create"}
        {#if $creator.binding}{#key $creator.binding}<Snapshot
              value={$creator.binding}
            >
              {#snippet children(binding)}
                <TitledDialog
                  open={$creator.open && !$creator.inline}
                  title={text("new")}
                  description={text("createHelp")}
                  closeLabel={text("close")}
                  onOpenChange={(open) => {
                    if (
                      !open &&
                      current(intent) &&
                      !$creator.inline &&
                      controller.creator.owns(binding)
                    )
                      controller.creator.close(binding);
                  }}
                  initialFocus={() => createInput}
                  returnFocus={() => focusBack(intent)}
                >
                  <form
                    class="space-y-3"
                    aria-busy={$creator.busy}
                    onsubmit={(event) => {
                      event.preventDefault();
                      if (
                        !current(intent) ||
                        !event.currentTarget.isConnected ||
                        $creator.inline ||
                        !controller.creator.owns(binding)
                      )
                        return;
                      void controller.creator.submit(binding);
                    }}
                  >
                    <Label for="new-room">{text("createLabel")}</Label><Textarea
                      bind:ref={createInput}
                      id="new-room"
                      rows={4}
                      placeholder={text("createPlaceholder")}
                      value={$draft.create}
                      disabled={$creator.busy}
                      oninput={(event) => {
                        if (
                          current(intent) &&
                          event.currentTarget.isConnected &&
                          !$creator.inline &&
                          controller.creator.owns(binding)
                        )
                          controller.creator.edit(
                            event.currentTarget.value,
                            binding,
                          );
                      }}
                      onkeydown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.isComposing &&
                          !$creator.inline &&
                          current(intent) &&
                          event.currentTarget.isConnected &&
                          controller.creator.owns(binding)
                        ) {
                          event.preventDefault();
                          void controller.creator.submit(binding);
                        }
                      }}
                    />
                    <div class="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onclick={(event) => {
                          if (
                            current(intent) &&
                            event.currentTarget.isConnected &&
                            controller.creator.owns(binding)
                          )
                            controller.creator.close(binding);
                        }}>{text("cancel")}</Button
                      ><Button
                        type="submit"
                        disabled={$creator.busy}
                        aria-busy={$creator.busy || undefined}
                        >{#if $creator.busy}<Spinner size="xs" />{/if}{text(
                          $creator.busy ? "creating" : "create",
                        )}</Button
                      >
                    </div>
                    {#if $creator.error}<p
                        role="alert"
                        class="break-words text-destructive"
                      >
                        {homeIssue(lang, $creator.error)}
                      </p>{/if}
                  </form>
                </TitledDialog>
              {/snippet}</Snapshot
            >{/key}{/if}
      {:else if intent.kind === "settings"}
        <TitledDialog
          open={!!selectedRoom}
          title={text("roomSettings", { title: selectedRoom?.title ?? "" })}
          closeLabel={text("close")}
          onOpenChange={(open) => {
            if (!open && current(intent)) controller.closeSettings();
          }}
          returnFocus={() => focusBack(intent)}
        >
          {#if selectedRoom}{@const room = selectedRoom}
            <fieldset class="m-0 space-y-2 border-0 p-0">
              <legend>{text("tint")}</legend>
              <div class="flex flex-wrap gap-2">
                {#each [null, ...TINTS] as tint}<Button
                    size="sm"
                    variant={room.tint === tint ? "secondary" : "outline"}
                    aria-pressed={room.tint === tint}
                    disabled={!!$mutations.pending[`tint:${room.id}`]}
                    onclick={(event) => {
                      if (current(intent) && event.currentTarget.isConnected)
                        controller.rooms.tint(room.id, tint);
                    }}>{text(tint ?? "none")}</Button
                  >{/each}
              </div>
            </fieldset>
            {@render iconField(room, intent)}
            <div class="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!!$mutations.pending.order}
                onclick={(event) => {
                  if (current(intent) && event.currentTarget.isConnected)
                    controller.move(room.id, -1);
                }}>{text("moveUp")}</Button
              ><Button
                variant="outline"
                disabled={!!$mutations.pending.order}
                onclick={(event) => {
                  if (current(intent) && event.currentTarget.isConnected)
                    controller.move(room.id, 1);
                }}>{text("moveDown")}</Button
              >{#if $nav.roomId === room.id && controller.callbacks.rename}<Button
                  variant="outline"
                  onclick={(event) => {
                    if (current(intent) && event.currentTarget.isConnected)
                      controller.askRename(room.id);
                  }}>{text("rename")}</Button
                >{/if}<Button
                variant="destructive"
                onclick={(event) => {
                  if (current(intent) && event.currentTarget.isConnected)
                    controller.askArchive(room.id);
                }}>{text("archiveAction")}</Button
              >
            </div>
            {#each [`tint:${room.id}`, "order"] as key}{#if $mutations.issues[key]}<p
                  role="alert"
                  class="break-words text-destructive"
                >
                  {homeIssue(lang, $mutations.issues[key]!)}
                </p>{/if}{/each}
          {/if}
        </TitledDialog>
      {:else if intent.kind === "archive"}
        <TitledDialog
          open={!!archiveRoom}
          title={text("archiveTitle", { title: archiveRoom?.title ?? "" })}
          description={text("archiveHelp")}
          closeLabel={text("close")}
          onOpenChange={(open) => {
            if (!open && current(intent)) controller.closeSettings();
          }}
          initialFocus={() => archiveCancel}
          returnFocus={() => focusBack(intent)}
        >
          {#if archiveRoom}<div class="flex flex-wrap gap-2">
              <Button
                bind:ref={archiveCancel}
                variant="outline"
                onclick={(event) => {
                  if (current(intent) && event.currentTarget.isConnected)
                    controller.closeSettings();
                }}>{text("cancel")}</Button
              ><Button
                variant="destructive"
                disabled={!!$mutations.pending[`archive:${archiveRoom.id}`]}
                aria-busy={!!$mutations.pending[`archive:${archiveRoom.id}`] ||
                  undefined}
                onclick={(event) => {
                  if (current(intent) && event.currentTarget.isConnected)
                    controller.confirmArchive();
                }}
                >{#if $mutations.pending[`archive:${archiveRoom.id}`]}<Spinner
                    size="xs"
                  />{/if}{text("archiveAction")}</Button
              >
            </div>
            {#if $mutations.issues[`archive:${archiveRoom.id}`]}<p
                role="alert"
                class="break-words text-destructive"
              >
                {homeIssue(
                  lang,
                  $mutations.issues[`archive:${archiveRoom.id}`]!,
                )}
              </p>{/if}{/if}
        </TitledDialog>
      {:else if intent.kind === "rename"}
        <TitledDialog
          open={!!renameRoom}
          title={text("editRoom")}
          closeLabel={text("close")}
          onOpenChange={(open) => {
            if (!open && current(intent)) controller.closeSettings();
          }}
          initialFocus={() => renameInput}
          returnFocus={() => focusBack(intent)}
        >
          {#if renameRoom}<form
              class="space-y-3"
              onsubmit={(event) => {
                event.preventDefault();
                if (!current(intent) || !event.currentTarget.isConnected)
                  return;
                void controller.rename();
              }}
            >
              {@render iconField(renameRoom, intent)}
              <Label for="room-name">{text("name")}</Label><Input
                bind:ref={renameInput}
                id="room-name"
                required
                maxlength={120}
                value={$nav.renameDraft}
                oninput={(event) => {
                  if (current(intent) && event.currentTarget.isConnected)
                    controller.editRename(event.currentTarget.value);
                }}
                disabled={$nav.renameBusy ||
                  !!$mutations.pending[`rename:${renameRoom.id}`]}
              />
              <div class="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onclick={(event) => {
                    if (current(intent) && event.currentTarget.isConnected)
                      controller.closeSettings();
                  }}>{text("cancel")}</Button
                ><Button
                  type="submit"
                  disabled={$nav.renameBusy ||
                    !!$mutations.pending[`rename:${renameRoom.id}`]}
                  aria-busy={$nav.renameBusy ||
                    !!$mutations.pending[`rename:${renameRoom.id}`] ||
                    undefined}
                  >{#if $nav.renameBusy || $mutations.pending[`rename:${renameRoom.id}`]}<Spinner
                      size="xs"
                    />{/if}{text("save")}</Button
                >
              </div>
              {#if $mutations.issues[`rename:${renameRoom.id}`]}<p
                  role="alert"
                  class="break-words text-destructive"
                >
                  {homeIssue(
                    lang,
                    $mutations.issues[`rename:${renameRoom.id}`]!,
                  )}
                </p>{/if}
            </form>{/if}
        </TitledDialog>
      {/if}{/snippet}</Snapshot
  >{/each}
