<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import type { Snippet } from "svelte";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Checkbox from "../../lib/studio/Checkbox.svelte";
  import UiSwitch from "../home/UiSwitch.svelte";
  import ThemeIcon from "../app-navigation/ThemeIcon.svelte";
  import ToggleGroup from "../../lib/studio/ToggleGroup.svelte";
  import ToggleGroupItem from "../../lib/studio/ToggleGroupItem.svelte";
  import { homeText } from "../home/copy";
  import { SETTINGS_SECTIONS, settingsText } from "./settings";
  import type { AccountSession, AccountBinding } from "./session";
  import type { DeviceLock } from "./device";
  import { avatarImage } from "./image";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  /**
   * The settings page (/settings): you (name, photo, how you sign in), the
   * agents you connected, cloud agents, this device, and signing out. Each
   * section is an anchor (`#profile`, `#agents`, `#cloud`, `#device`), the
   * sections the page's sidebar lists.
   */
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
    cloud,
  }: {
    owner: AccountSession;
    device: DeviceLock;
    lang: string;
    theme: "auto" | "light" | "dark";
    onTheme(theme: "auto" | "light" | "dark"): void;
    onLanguage(lang: "pt" | "en"): void;
    onArchive(): void;
    onLogout(all: boolean): void;
    notifications: Snippet;
    agentSettings: Snippet;
    cloud: Snippet;
  } = $props();
  const view = untrack(() => owner.state),
    lock = untrack(() => device.state),
    en = $derived(lang === "en"),
    text = (key: Parameters<typeof settingsText>[1]) =>
      settingsText(en ? "en" : "pt", key),
    home = (key: Parameters<typeof homeText>[1]) =>
      homeText(en ? "en" : "pt", key);
  let active = true;
  onDestroy(() => {
    active = false;
    device.cancel();
  });
  // A link to a section (`/settings#cloud`) lands on it, once the sections are drawn.
  let hash = $state(location.hash);
  onMount(() => {
    const changed = () => (hash = location.hash);
    addEventListener("hashchange", changed);
    addEventListener("popstate", changed);
    return () => {
      removeEventListener("hashchange", changed);
      removeEventListener("popstate", changed);
    };
  });
  $effect(() => {
    const id = hash.slice(1);
    if (
      $view.open &&
      $view.me &&
      SETTINGS_SECTIONS.includes(id as (typeof SETTINGS_SECTIONS)[number])
    )
      void tick().then(() =>
        document.getElementById(id)?.scrollIntoView({ block: "start" }),
      );
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
    photo: HTMLInputElement | undefined = $state();
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
  const themes = [
    { value: "auto", label: "themeAuto" },
    { value: "light", label: "themeLight" },
    { value: "dark", label: "themeDark" },
  ] as const;
  const section = "tw:flex tw:scroll-mt-6 tw:flex-col tw:gap-4";
  const rowClass =
    "tw:flex tw:min-h-11 tw:flex-wrap tw:items-center tw:justify-between tw:gap-x-4 tw:gap-y-2";
</script>

{#if $view.binding && $view.open}{#key $view.binding}<Snapshot
      value={$view.binding}
      >{#snippet children(rendered: AccountBinding)}
        {#if $view.me}<div
            data-vb-native
            data-native-account
            class="tw:mx-auto tw:w-full tw:max-w-2xl tw:flex tw:flex-col tw:gap-12 tw:px-4 tw:py-8 tw:font-sans tw:text-sm tw:text-foreground tw:md:px-8 tw:md:py-10"
          >
            <Heading level={1} class="tw:m-0 tw:font-sans tw:text-2xl"
              >{text("title")}</Heading
            >
            <section id="profile" class={section}>
              <Heading level={2} class="tw:m-0 tw:text-base"
                >{text("profile")}</Heading
              >
              <div class="tw:flex tw:items-center tw:gap-3">
                <PersonAvatar
                  size="lg"
                  email={$view.me.email}
                  version={$view.me.avatar}
                />
                <div class="tw:min-w-0 tw:flex-1 tw:break-words">
                  <p class="tw:m-0 tw:font-medium">
                    {$view.me.name || $view.me.email}
                  </p>
                  <p class="tw:m-0 tw:text-sm tw:text-muted-foreground">
                    {$view.me.email}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onclick={(event) => {
                    if (live(event, rendered)) photo?.click();
                  }}>{en ? "Change photo" : "Trocar foto"}</Button
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
              <form
                class="tw:flex tw:flex-col tw:gap-2"
                onsubmit={(event) => {
                  event.preventDefault();
                  if (live(event, rendered) && !busy) owner.rename(name);
                }}
              >
                <Label for="account-name">{en ? "Your name" : "Seu nome"}</Label
                >
                <div class="tw:flex tw:gap-2">
                  <Input
                    id="account-name"
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
                </div>
              </form>
              {#if $view.phase === "pending" || $view.phase === "confirming"}<p
                  role="status"
                  class="tw:m-0 tw:text-sm tw:text-muted-foreground"
                >
                  {en ? "Waiting for confirmation…" : "Esperando confirmação…"}
                </p>{/if}
              {#if $view.phase === "error"}<p
                  role="alert"
                  class="tw:m-0 tw:text-sm tw:text-destructive"
                >
                  {en
                    ? "Could not save this change. Check the details and try again."
                    : "Não deu para salvar esta mudança. Confira os dados e tente de novo."}
                </p>{/if}
              {#if $view.phase === "unconfirmed"}<div
                  role="alert"
                  class="tw:space-y-2 tw:text-sm"
                >
                  <p class="tw:m-0">
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
              <div class="tw:flex tw:flex-col tw:gap-2">
                <Heading level={3} class="tw:m-0 tw:text-sm"
                  >{en ? "How you sign in" : "Como você entra"}</Heading
                >
                {#if $view.loginsLoading}<p role="status" class="tw:m-0">
                    {en ? "Loading…" : "Carregando…"}
                  </p>{:else if $view.loginsError}<p
                    role="alert"
                    class="tw:m-0"
                  >
                    {en
                      ? "Could not load sign-in history."
                      : "Não deu para carregar o histórico de entrada."}
                  </p>
                  <Button
                    variant="outline"
                    onclick={(event) => {
                      if (live(event, rendered)) owner.logins();
                    }}>{en ? "Retry" : "Tentar de novo"}</Button
                  >{:else if $view.logins}<ul
                    class="tw:m-0 tw:list-none tw:space-y-2 tw:p-0"
                  >
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
                <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                  {en
                    ? "Google and GitHub use their email's account. A different email means a different account."
                    : "Google e GitHub entram na conta do email deles: se for outro email, vira outra conta."}
                </p>
              </div>
            </section>
            <section id="agents" data-native-account-agents class={section}>
              <Heading level={2} class="tw:m-0 tw:text-base"
                >{text("agents")}</Heading
              >
              {@render agentSettings()}
            </section>
            <section id="cloud" class={section}>
              <Heading level={2} class="tw:m-0 tw:text-base"
                >{text("cloud")}</Heading
              >
              {@render cloud()}
            </section>
            <section id="device" class={section}>
              <Heading level={2} class="tw:m-0 tw:text-base"
                >{text("device")}</Heading
              >
              <div class="tw:divide-y tw:divide-border">
                <div class={rowClass}>
                  <span>{home("notifications")}</span>{@render notifications()}
                </div>
                <div class={rowClass}>
                  <span id="settings-theme">{home("theme")}</span>
                  <ToggleGroup
                    type="single"
                    variant="segmented"
                    aria-labelledby="settings-theme"
                    bind:value={
                      () => theme,
                      (next) => {
                        if (active && next && next !== theme)
                          onTheme(next as (typeof themes)[number]["value"]);
                      }
                    }
                    >{#each themes as option (option.value)}<ToggleGroupItem
                        value={option.value}
                        aria-label={home(option.label)}
                        tooltip={home(option.label)}
                        iconOnly
                        ><ThemeIcon theme={option.value} /></ToggleGroupItem
                      >{/each}</ToggleGroup
                  >
                </div>
                <div class={rowClass}>
                  <span id="settings-language">{home("language")}</span>
                  <ToggleGroup
                    type="single"
                    variant="segmented"
                    aria-labelledby="settings-language"
                    bind:value={
                      () => lang,
                      (next) => {
                        if (active && (next === "pt" || next === "en"))
                          if (next !== lang) onLanguage(next);
                      }
                    }
                    >{#each ["pt", "en"] as language (language)}<ToggleGroupItem
                        value={language}
                        >{language.toUpperCase()}</ToggleGroupItem
                      >{/each}</ToggleGroup
                  >
                </div>
                <!-- Off = the classic app on this device. -->
                <div class={rowClass}><UiSwitch lang={en ? "en" : "pt"} /></div>
                <div class="tw:flex tw:flex-col tw:gap-1 tw:py-3">
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
                  <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                    {en
                      ? "A local lock on this device; your login session stays the same."
                      : "Uma trava local neste aparelho; sua sessão continua a mesma."}
                  </p>
                  {#if !$lock.supported}<p
                      class="tw:m-0 tw:text-xs tw:text-muted-foreground"
                    >
                      {en
                        ? "Unavailable in this browser."
                        : "Não disponível neste navegador."}
                    </p>{/if}{#if $lock.error}<p
                      role="alert"
                      class="tw:m-0 tw:text-sm tw:text-destructive"
                    >
                      {en
                        ? "Device authentication was cancelled or failed. Try again."
                        : "A autenticação do aparelho foi cancelada ou falhou. Tente de novo."}
                    </p>{/if}
                </div>
              </div>
            </section>
            <section
              class="tw:flex tw:flex-wrap tw:gap-2 tw:border-t tw:border-border tw:pt-6"
              aria-label={en ? "Account" : "Conta"}
            >
              <Button
                variant="outline"
                onclick={(event) => {
                  if (live(event, rendered)) onArchive();
                }}>{en ? "Archived rooms" : "Salas arquivadas"}</Button
              ><span class="tw:flex-1"></span><Button
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
            </section>
          </div>{/if}
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
