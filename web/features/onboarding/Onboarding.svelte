<script lang="ts">
  import { untrack, tick } from "svelte";
  import ImagePicker from "../../lib/components/ImagePicker.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { studioType } from "../../lib/components/type";
  import Button from "../../lib/studio/Button.svelte";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogDescription from "../../lib/studio/DialogDescription.svelte";
  import DialogFooter from "../../lib/studio/DialogFooter.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import { registerDialog } from "../../lib/studio/dialogController";
  import SetupInstructions from "../agents/SetupInstructions.svelte";
  import OnboardingArt from "./OnboardingArt.svelte";
  import { avatarImage } from "../account/image";
  import { createApplicationCopy } from "../application/copy";
  import { homeIssue } from "../home/copy";
  import type { OnboardingSession } from "./session";
  /** The first run as a dialog over the real Home: three steps, each one skippable.
   * Closing it skips them all for good; name, photo and agent stay in Settings.
   * No language switch here: the app follows the browser and Settings › Idioma. */
  let {
    owner,
    lang,
  }: {
    owner: OnboardingSession;
    lang: "pt" | "en";
  } = $props();
  const view = untrack(() => owner.state),
    account = untrack(() => owner.personal.state),
    profile = untrack(() => owner.profile.state),
    creator = untrack(() => owner.creator.state),
    draft = untrack(() => owner.personal.draft);
  const t = $derived(createApplicationCopy(lang));
  const busyProfile = $derived(
    ["pending", "confirming", "unconfirmed"].includes($profile.phase),
  );
  let nameInput = $state<HTMLInputElement | null>(null),
    roomInput = $state<HTMLTextAreaElement | null>(null);
  const focusScope = $derived(
    $view.visible
      ? `${$account.identityRevision}:${$account.me?.email}:${$view.step}`
      : "",
  );
  const actionScope = $derived(
    `${focusScope}:${$view.profileBinding?.generation ?? "-"}:${$view.creatorBinding?.generation ?? "-"}`,
  );
  const stepTarget = () =>
    $view.step === 1 ? nameInput : $view.step === 3 ? roomInput : null;
  $effect(() => {
    const scope = focusScope;
    if (!scope) return;
    void tick().then(() => {
      if (!owner.current() || focusScope !== scope) return;
      const target = stepTarget();
      if (target?.isConnected) target.focus();
    });
  });
  $effect(() => {
    if ($view.visible)
      return registerDialog(() => {
        if (owner.current()) owner.skipHome();
      });
  });
  // A connected outgoing step may survive until Svelte flushes. Its DOM scope
  // must still match the canonical presentation before a gesture can act.
  const live = (event: Event) =>
    owner.current() &&
    $view.visible &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected &&
    event.currentTarget
      .closest("[data-onboarding]")
      ?.getAttribute("data-onboarding-scope") === owner.actionScope();
  const skip = (event: Event) => {
    if (live(event)) owner.skip();
  };
  const back = (event: Event) => {
    if (live(event)) owner.back();
  };
</script>

<Dialog
  open={$view.visible}
  onOpenChange={(open) => {
    // The ✕ or Escape: skip what is left, and do not come back on the next load.
    if (!open && owner.current() && $view.visible) owner.skipHome();
  }}
>
  <DialogContent
    data-onboarding
    data-onboarding-step={$view.step}
    data-onboarding-scope={actionScope}
    closeLabel={t("Fechar e ver a home")}
    preventScroll={false}
    preventOverflowTextSelection={false}
    onInteractOutside={(event) => event.preventDefault()}
    onOpenAutoFocus={(event) => {
      const target = stepTarget();
      event.preventDefault();
      if (target?.isConnected) target.focus();
    }}
    class={[
      studioType,
      "flex max-h-[90dvh] flex-col gap-6 overflow-auto bg-card backdrop-blur-none text-sm leading-6 text-foreground",
    ].join(" ")}
  >
    <!-- One skeleton for every step: picture, title, short description, content, footer. -->
    <OnboardingArt
      step={$view.step}
      email={$account.me?.email}
      avatar={$account.me?.avatar}
      name={$view.name}
      placeholder={t("Seu nome")}
    />
    <DialogHeader class="gap-1.5 text-left md:text-left">
      <DialogTitle class="text-xl md:text-2xl"
        >{t(
          $view.step === 1
            ? "Como seus amigos te chamam?"
            : $view.step === 2
              ? "Conecte seu Claude"
              : "Sua primeira sala",
        )}</DialogTitle
      >
      <DialogDescription class="text-sm text-muted-foreground"
        >{t(
          $view.step === 1
            ? "O pessoal e os agents vão te chamar assim."
            : $view.step === 2
              ? "No deco.chat cada pessoa traz o próprio Claude: ele lê a sala, trabalha nas tarefas e te pergunta antes de agir. Cole isto no Claude Code, dentro da pasta do projeto:"
              : "Uma sala por projeto: conversa, doc e tarefas. Diga o que é e com quem; quem você citar é convidado.",
        )}</DialogDescription
      >
    </DialogHeader>
    {#if $view.step === 1}
      <form
        id="onboarding-name"
        class="grid gap-4"
        onsubmit={(event) => {
          event.preventDefault();
          if (live(event)) owner.continueName();
        }}
      >
        <!-- The photo first, then the name: you, as people will see you. -->
        <div class="flex items-center gap-3">
          <ImagePicker
            id="onboarding-photo"
            label={t(
              $account.me?.avatar ? "Trocar foto" : "Adicionar foto (opcional)",
            )}
            dropLabel={t("Solte a imagem aqui")}
            disabled={busyProfile || !$view.profileBinding}
            onfile={(file, event) => {
              if (live(event))
                owner.photo((current) => avatarImage(file, current));
            }}
            ><PersonAvatar
              size="lg"
              email={$account.me?.email}
              version={$account.me?.avatar}
            /></ImagePicker
          >
          <Input
            bind:ref={nameInput}
            value={$view.name}
            oninput={(event) => {
              if (live(event)) owner.editName(event.currentTarget.value);
            }}
            placeholder={t("Seu nome")}
            aria-label={t("Seu nome")}
            required
            maxlength={60}
            autocomplete="given-name"
            disabled={busyProfile || !$view.profileBinding}
            class="min-w-0 flex-1"
          />
        </div>
        {#if $profile.phase === "pending" || $profile.phase === "confirming"}<p
            role="status"
            class="m-0 text-muted-foreground"
          >
            {t("Esperando confirmação…")}
          </p>{:else if $profile.phase === "error"}<p
            role="alert"
            class="m-0 text-destructive"
          >
            {t("Não foi possível salvar. Confira os dados e tente novamente.")}
          </p>{:else if $profile.phase === "unconfirmed"}<p
            role="status"
            class="m-0 text-muted-foreground"
          >
            {t(
              "Ainda sem confirmação. Confira o estado atual antes de tentar novamente.",
            )}
          </p>
          <Button
            variant="outline"
            class="justify-self-start"
            onclick={(event) => {
              if (live(event)) owner.reviewProfile();
            }}>{t("Conferi o estado atual")}</Button
          >{/if}
      </form>
    {:else if $view.step === 2}
      {#if $view.connectedNotice}<p
          role="status"
          class="m-0 rounded-surface bg-muted p-4 font-semibold text-success"
        >
          ✓ {t("Seu agent conectou.")}
        </p>{:else}<SetupInstructions
          origin={location.origin}
          {lang}
          intro={false}
          current={owner.current}
        />{/if}
    {:else}
      <form
        id="onboarding-room"
        class="grid gap-2"
        onsubmit={(event) => {
          event.preventDefault();
          if (live(event)) void owner.createRoom();
        }}
      >
        <Textarea
          bind:ref={roomInput}
          rows={3}
          value={$draft.create}
          oninput={(event) => {
            if (live(event)) owner.editRoom(event.currentTarget.value);
          }}
          required
          aria-label={t("Sua primeira sala")}
          placeholder={t(
            "Ex.: viagem de avião pra SP com os dogs, eu e a Alexia",
          )}
          disabled={$creator.busy || !$view.creatorBinding}
          onkeydown={(event) => {
            if (
              live(event) &&
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.isComposing
            ) {
              event.preventDefault();
              void owner.createRoom();
            }
          }}
        />{#if $creator.error}<p
            role="alert"
            class="m-0 text-sm text-destructive"
          >
            {homeIssue(lang, $creator.error)}
          </p>{/if}
      </form>
    {/if}
    <!-- Where you are on the left (small dots, the current one longer), the actions on the right. -->
    <DialogFooter
      class="flex-row flex-wrap items-center justify-between gap-y-2 md:justify-between"
    >
      <span class="flex items-center gap-1.5" data-onboarding-progress>
        {#each [1, 2, 3] as step (step)}<span
            aria-hidden="true"
            class={[
              "h-1.5 rounded-full",
              step === $view.step
                ? "w-5 bg-primary"
                : "w-1.5 bg-muted-foreground",
            ]}
          ></span>{/each}<span class="sr-only"
          >{t("Passo {n} de 3", { n: $view.step })}</span
        >
      </span>
      <span class="flex flex-wrap items-center justify-end gap-2">
        {#if $view.step !== 1}<Button variant="ghost" onclick={back}
            >{t("Voltar")}</Button
          >{/if}
        <!-- Step 2 has no primary: it moves on by itself when the agent connects. -->
        <Button variant="ghost" onclick={skip}>{t("Pular")}</Button>
        {#if $view.step === 1}<Button
            type="submit"
            form="onboarding-name"
            disabled={busyProfile || !$view.profileBinding}
            >{t("Continuar")}</Button
          >{:else if $view.step === 3}<Button
            type="submit"
            form="onboarding-room"
            disabled={$creator.busy || !$view.creatorBinding}
            >{t($creator.busy ? "Criando…" : "Criar a sala")}</Button
          >{/if}
      </span>
    </DialogFooter>
  </DialogContent>
</Dialog>
