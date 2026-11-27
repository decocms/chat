<script lang="ts">
  import TitledDialog from "../../lib/components/TitledDialog.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import { createApplicationCopy } from "../application/copy";
  import type { RoomTint } from "../home/api";
  import { homeIssue, homeText, type HomeLanguage } from "../home/copy";
  import type { AppNavigationSession } from "./controller";
  import TintPicker from "./TintPicker.svelte";
  import { knownTint } from "./tints";
  /** "Configurações da pasta": the folder's name and color, yours only (the color picker of "Editar sala…"). */
  let {
    controller,
    lang,
  }: {
    controller: AppNavigationSession;
    lang: HomeLanguage;
  } = $props();
  const personal = $derived(controller.personal.state),
    nav = $derived(controller.state),
    mutations = $derived(controller.rooms.state);
  const t = $derived(createApplicationCopy(lang));
  const folder = $derived(
    $nav.folderSettings
      ? $personal.me?.folders?.find(
          (folder) => folder.id === $nav.folderSettings,
        )
      : null,
  );
  let name = $state(""),
    tint = $state<RoomTint>(null),
    editing = $state<string | null>(null),
    submitted = $state(false),
    input = $state<HTMLInputElement | null>(null);
  // A new dialog starts from the folder as it is.
  $effect(() => {
    if (folder && editing !== folder.id) {
      editing = folder.id;
      name = folder.name ?? "";
      tint = knownTint(folder.tint);
      submitted = false;
    }
    if (!$nav.folderSettings) editing = null;
  });
  const key = $derived(folder ? `folder:${folder.id}` : "");
  const busy = $derived(!!key && !!$mutations.pending[key]);
  const issue = $derived(key ? $mutations.issues[key] : undefined);
  // Saved: the dialog closes once the server has it.
  $effect(() => {
    if (submitted && folder && !busy && !issue) controller.closeSettings();
  });
  /** The name as the server keeps it: one line, at most 40 characters. */
  const clean = (value: string) =>
    value
      .replace(/\s+/g, " ")
      .replace(/[<>"\p{Cc}]/gu, "")
      .trim()
      .slice(0, 40) || null;
</script>

<TitledDialog
  open={!!folder}
  title={t("Configurações da pasta")}
  closeLabel={homeText(lang, "close")}
  onOpenChange={(open) => {
    if (!open) controller.closeSettings();
  }}
  initialFocus={() => input}
  returnFocus={() => controller.returnFocus(null)}
>
  {#if folder}<form
      data-folder-settings={folder.id}
      class="space-y-3"
      onsubmit={(event) => {
        event.preventDefault();
        if (!event.currentTarget.isConnected || busy) return;
        submitted = true;
        void controller.rooms.folder(folder.id, { name: clean(name), tint });
      }}
    >
      <Label for="folder-name">{homeText(lang, "name")}</Label><Input
        bind:ref={input}
        bind:value={name}
        id="folder-name"
        maxlength={40}
        placeholder={t("Pasta")}
        disabled={busy}
      />
      <fieldset class="min-w-0 space-y-2 border-0 p-0" data-folder-tints>
        <legend class="mb-1 p-0 text-sm font-medium">{t("Cor")}</legend>
        <TintPicker
          value={tint}
          {lang}
          disabled={busy}
          onpick={(next) => (tint = next)}
        />
      </fieldset>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" onclick={() => controller.closeSettings()}
          >{homeText(lang, "cancel")}</Button
        ><Button type="submit" disabled={busy} aria-busy={busy || undefined}
          >{#if busy}<Spinner size="xs" />{/if}{homeText(lang, "save")}</Button
        >
      </div>
      {#if issue}<p role="alert" class="break-words text-destructive">
          {homeIssue(lang, issue)}
        </p>{/if}
    </form>{/if}
</TitledDialog>
