<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { onDestroy, untrack } from "svelte";
  import type { Snippet } from "svelte";
  import Sheet from "../../lib/studio/Sheet.svelte";
  import SheetClose from "../../lib/studio/SheetClose.svelte";
  import SheetContent from "../../lib/studio/SheetContent.svelte";
  import SheetHeader from "../../lib/studio/SheetHeader.svelte";
  import SheetTitle from "../../lib/studio/SheetTitle.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import { registerDialog } from "../../lib/studio/dialogController";
  import { X } from "../../lib/studio/icons";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Checkbox from "../../lib/studio/Checkbox.svelte";
  import type { AccountSession, AccountBinding } from "./session";
  import type { DeviceLock } from "./device";
  import { avatarImage } from "./image";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  let {
    owner,
    device,
    lang,
    theme,
    onTheme,
    onLanguage,
    onArchive,
    onLogout,
    notifications,
    agentSettings,
  }: {
    owner: AccountSession;
    device: DeviceLock;
    lang: string;
    theme: "auto" | "light" | "dark";
    onTheme(): void;
    onLanguage(lang: "pt" | "en"): void;
    onArchive(): void;
    onLogout(all: boolean): void;
    notifications: Snippet;
    agentSettings: Snippet;
  } = $props();
  const view = untrack(() => owner.state),
    lock = untrack(() => device.state),
    en = $derived(lang === "en");
  let active = true;
  onDestroy(() => {
    active = false;
    owner.close();
    device.cancel();
  });
  const live = (event: Event, binding: AccountBinding) =>
    active &&
    owner.owns(binding) &&
    draftAccount === binding.account &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected;
  const busy = $derived(
    $view.phase === "pending" ||
      $view.phase === "confirming" ||
      $view.phase === "unconfirmed",
  );
  let name = $state(""),
    draftAccount = $state(""),
    lastName = $state(""),
    wasOpen = $state(false),
    photo: HTMLInputElement | undefined = $state(),
    nameInput: HTMLInputElement | null = $state(null),
    agentsBlock: HTMLDivElement | null = $state(null);
  let logoutAll = $state.raw<{
    account: string;
    binding: AccountBinding;
  } | null>(null);
  $effect(() => {
    const me = $view.me;
    if (me?.email !== draftAccount) {
      draftAccount = me?.email ?? "";
      name = lastName = me?.name ?? "";
      logoutAll = null;
    } else if (me && me.name !== lastName) {
      if (name === lastName) name = me.name ?? "";
      lastName = me.name ?? "";
    }
    if (!$view.open) {
      logoutAll = null;
      if (wasOpen) device.cancel();
    }
    wasOpen = $view.open;
  });
  $effect(() => {
    const binding = $view.binding;
    if ($view.open && binding)
      return registerDialog(() => {
        if ($view.presentation !== "inline" && owner.owns(binding))
          owner.close();
      });
  });
  const loginRows = $derived(
    [
      {
        method: "email",
        label: en ? "Email code" : "Código por email",
        show: true,
      },
      {
        method: "google",
        label: "Google",
        show:
          $view.logins?.providers.google ||
          $view.logins?.logins.some((row) => row.method === "google"),
      },
      {
        method: "github",
        label: "GitHub",
        show:
          $view.logins?.providers.github ||
          $view.logins?.logins.some((row) => row.method === "github"),
      },
      {
        method: "invite",
        label: en ? "Invite link" : "Link de convite",
        show: $view.logins?.logins.some((row) => row.method === "invite"),
      },
    ].filter((row) => row.show),
  );
</script>

{#if $view.binding}{#key $view.binding}<Snapshot value={$view.binding}
      >{#snippet children(rendered: AccountBinding)}
        <Sheet
          open={$view.open}
          onOpenChange={(open) => {
            if (
              !open &&
              $view.presentation !== "inline" &&
              owner.owns(rendered)
            )
              owner.close();
          }}
        >
          <SheetContent
            data-vb-native
            hideCloseButton
            preventScroll={false}
            preventBodyPointerEvents={false}
            preventOverflowTextSelection={false}
            onOpenAutoFocus={(event) => {
              const target =
                $view.section === "profile"
                  ? nameInput
                  : $view.section === "agents"
                    ? agentsBlock
                    : null;
              if (target) {
                event.preventDefault();
                target.focus();
              }
            }}
            onCloseAutoFocus={(event) => {
              const target = owner.returnFocus();
              if (target?.isConnected) {
                event.preventDefault();
                target.focus();
              }
            }}
            class="tw:w-full tw:overflow-auto tw:p-6 tw:font-sans tw:text-sm tw:text-foreground tw:sm:w-96"
          >
            <SheetHeader class="tw:p-0 tw:pr-10">
              <SheetTitle class="tw:font-sans tw:text-lg"
                >{en ? "Your account" : "Sua conta"}</SheetTitle
              >
            </SheetHeader>
            <SheetClose
              aria-label={en ? "Close" : "Fechar"}
              class={buttonVariants({
                variant: "ghost",
                size: "icon-sm",
                class: "tw:absolute tw:right-4 tw:top-4",
              })}><Icon icon={X} /></SheetClose
            >
            {#if $view.me}<div data-native-account class="tw:space-y-6">
                <div class="tw:flex tw:items-center tw:gap-3">
                  <PersonAvatar
                    size="lg"
                    email={$view.me.email}
                    version={$view.me.avatar}
                  />
                  <div class="tw:min-w-0 tw:break-words">
                    <p class="tw:font-medium">
                      {$view.me.name || $view.me.email}
                    </p>
                    <p class="tw:text-sm tw:text-muted-foreground">
                      {$view.me.email}
                    </p>
                  </div>
                </div>
                <form
                  class="tw:space-y-2"
                  onsubmit={(event) => {
                    event.preventDefault();
                    if (live(event, rendered) && !busy) owner.rename(name);
                  }}
                >
                  <Label for="account-name"
                    >{en ? "Your name" : "Seu nome"}</Label
                  ><Input
                    id="account-name"
                    bind:ref={nameInput}
                    value={name}
                    oninput={(event) => {
                      if (live(event, rendered))
                        name = event.currentTarget.value;
                    }}
                    required
                    maxlength={60}
                    autocomplete="given-name"
                    disabled={busy}
                  /><Button type="submit" disabled={busy}
                    >{en ? "Save name" : "Salvar nome"}</Button
                  >
                </form>
                <div>
                  <Button
                    disabled={busy}
                    onclick={(event) => {
                      if (live(event, rendered)) photo?.click();
                    }}>{en ? "Add photo" : "Adicionar foto"}</Button
                  ><input
                    bind:this={photo}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label={en ? "Profile photo" : "Foto do perfil"}
                    class="tw:sr-only"
                    onchange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (live(event, rendered) && file && !busy)
                        owner.photo((current) => avatarImage(file, current));
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
                {#if $view.phase === "pending" || $view.phase === "confirming"}<p
                    role="status"
                    class="tw:text-sm tw:text-muted-foreground"
                  >
                    {en
                      ? "Waiting for confirmation…"
                      : "Esperando confirmação…"}
                  </p>{/if}
                {#if $view.phase === "error"}<p
                    role="alert"
                    class="tw:text-sm tw:text-destructive"
                  >
                    {en
                      ? "Could not save this change. Check the details and try again."
                      : "Não deu para salvar esta mudança. Confira os dados e tente de novo."}
                  </p>{/if}
                {#if $view.phase === "unconfirmed"}<div
                    role="alert"
                    class="tw:space-y-2 tw:text-sm"
                  >
                    <p>
                      {en
                        ? "This change is unconfirmed. It may have been saved. Refresh before trying again."
                        : "Esta mudança não foi confirmada. Ela pode ter sido salva. Atualize antes de tentar de novo."}
                    </p>
                    <Button
                      variant="outline"
                      onclick={(event) => {
                        if (live(event, rendered)) owner.refresh();
                      }}>{en ? "Refresh" : "Atualizar"}</Button
                    ><Button
                      variant="outline"
                      onclick={(event) => {
                        if (live(event, rendered)) owner.review();
                      }}
                      >{en
                        ? "Review and try again"
                        : "Revisar e tentar de novo"}</Button
                    >
                  </div>{/if}
                <section class="tw:space-y-2">
                  <Heading level={2} class="tw:text-base"
                    >{en ? "How you sign in" : "Como você entra"}</Heading
                  >
                  {#if $view.loginsLoading}<p role="status">
                      {en ? "Loading…" : "Carregando…"}
                    </p>{:else if $view.loginsError}<p role="alert">
                      {en
                        ? "Could not load sign-in history."
                        : "Não deu para carregar o histórico de entrada."}
                    </p>
                    <Button
                      variant="outline"
                      onclick={(event) => {
                        if (live(event, rendered)) owner.logins();
                      }}>{en ? "Retry" : "Tentar de novo"}</Button
                    >{:else if $view.logins}<ul class="tw:space-y-2">
                      {#each loginRows as row}{@const used =
                          $view.logins.logins.find(
                            (item) => item.method === row.method,
                          )}
                        <li class="tw:flex tw:justify-between tw:gap-2">
                          <span>{row.label}</span><span
                            class="tw:text-xs tw:text-muted-foreground"
                            >{used
                              ? `${new Date(used.last).toLocaleDateString(lang)} · ${used.n}×`
                              : row.method === "email"
                                ? en
                                  ? "always works"
                                  : "sempre funciona"
                                : en
                                  ? "not used yet"
                                  : "ainda não usou"}</span
                          >
                        </li>{/each}
                    </ul>{/if}
                  <p class="tw:text-xs tw:text-muted-foreground">
                    {en
                      ? "Google and GitHub use their email's account. A different email means a different account."
                      : "Google e GitHub entram na conta do email deles: se for outro email, vira outra conta."}
                  </p>
                </section>
                <nav
                  class="tw:flex tw:flex-wrap tw:items-center tw:gap-2"
                  aria-label={en ? "Preferences" : "Preferências"}
                >
                  <Button
                    variant="outline"
                    onclick={(event) => {
                      if (live(event, rendered)) onArchive();
                    }}>{en ? "Archive" : "Arquivo"}</Button
                  ><Button
                    variant="outline"
                    onclick={(event) => {
                      if (live(event, rendered)) onTheme();
                    }}>{en ? `Theme: ${theme}` : `Tema: ${theme}`}</Button
                  >{#each ["pt", "en"] as language}<Button
                      variant={lang === language ? "secondary" : "ghost"}
                      onclick={(event) => {
                        if (
                          live(event, rendered) &&
                          (language === "pt" || language === "en")
                        )
                          onLanguage(language);
                      }}>{language.toUpperCase()}</Button
                    >{/each}{@render notifications()}
                </nav>
                <div class="tw:space-y-2">
                  <label class="tw:flex tw:items-center tw:gap-2"
                    ><Checkbox
                      bind:checked={
                        () => $lock.enabled,
                        (wanted) => {
                          const account = $view.me?.email;
                          if (
                            active &&
                            owner.owns(rendered) &&
                            draftAccount === rendered.account &&
                            account
                          )
                            void device.configure(wanted, account, () =>
                              owner.owns(rendered),
                            );
                        }
                      }
                      disabled={!$lock.supported || $lock.busy}
                    /><span
                      >{en
                        ? "Require Face ID when opening"
                        : "Exigir Face ID ao abrir"}</span
                    ></label
                  >
                  <p class="tw:text-xs tw:text-muted-foreground">
                    {en
                      ? "A local lock on this device; your login session stays the same."
                      : "Uma trava local neste aparelho; sua sessão continua a mesma."}
                  </p>
                  {#if !$lock.supported}<p
                      class="tw:text-xs tw:text-muted-foreground"
                    >
                      {en
                        ? "Unavailable in this browser."
                        : "Não disponível neste navegador."}
                    </p>{/if}{#if $lock.error}<p
                      role="alert"
                      class="tw:text-sm tw:text-destructive"
                    >
                      {en
                        ? "Device authentication was cancelled or failed. Try again."
                        : "A autenticação do aparelho foi cancelada ou falhou. Tente de novo."}
                    </p>{/if}
                </div>
                <!-- "My agents" lands here: focused (without a ring) so it scrolls into view. -->
                <div
                  bind:this={agentsBlock}
                  tabindex="-1"
                  data-native-account-agents
                  class="tw:outline-none"
                >
                  {@render agentSettings()}
                </div>
                <div class="tw:flex tw:flex-wrap tw:gap-2">
                  <Button
                    onclick={(event) => {
                      if (live(event, rendered)) onLogout(false);
                    }}>{en ? "Sign out" : "Sair"}</Button
                  ><Button
                    variant="outline"
                    onclick={(event) => {
                      if (live(event, rendered) && $view.me)
                        logoutAll = {
                          account: $view.me.email,
                          binding: rendered,
                        };
                    }}
                    >{en
                      ? "Sign out on every device"
                      : "Sair de todos os aparelhos"}</Button
                  >
                </div>
              </div>{/if}
          </SheetContent>
        </Sheet>
        {#if logoutAll && logoutAll.binding === rendered}{#key logoutAll}<Snapshot
              value={logoutAll}
              >{#snippet children(intent)}
                <ConfirmDialog
                  open
                  title={en
                    ? "Sign out on every device?"
                    : "Sair de todos os aparelhos?"}
                  description={en
                    ? "Every browser and phone will need to sign in again, including this one. Connected agents stay."
                    : "Todo navegador e celular vai pedir login de novo, este também. Seus agents conectados continuam."}
                  confirmLabel={en ? "Sign out" : "Sair"}
                  cancelLabel={en ? "Cancel" : "Cancelar"}
                  onOpenChange={(open) => {
                    if (!open && logoutAll === intent) logoutAll = null;
                  }}
                  onconfirm={() => {
                    if (
                      logoutAll === intent &&
                      owner.owns(intent.binding) &&
                      $view.me?.email === intent.account
                    ) {
                      logoutAll = null;
                      onLogout(true);
                    }
                  }}
                />
              {/snippet}</Snapshot
            >{/key}{/if}
      {/snippet}</Snapshot
    >{/key}{/if}
