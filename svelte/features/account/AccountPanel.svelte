<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import type { Snippet } from "svelte";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Switch from "../../lib/studio/Switch.svelte";
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
  // Each section: a title and one line of what it is, then a card of rows (label on the left, control on the right).
  const section = "flex scroll-mt-6 flex-col gap-3";
  const card =
    "overflow-hidden rounded-xl border border-border bg-card divide-y divide-border";
  const rowClass =
    "flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3";
  const hint = "m-0 text-xs leading-4 text-muted-foreground";
</script>

{#if $view.binding && $view.open}{#key $view.binding}<Snapshot
      value={$view.binding}
      >{#snippet children(rendered: AccountBinding)}
        {#if $view.me}<div
            data-vb-native
            data-native-account
            class="mx-auto w-full max-w-2xl flex flex-col gap-10 px-4 py-8 font-sans text-sm text-foreground md:px-8 md:py-12"
          >
            {#snippet head(title: string)}<Heading
                level={2}
                class="m-0 px-1 font-sans text-[0.9375rem] font-semibold"
                >{title}</Heading
              >{/snippet}
            <Heading level={1} class="m-0 px-1 font-sans text-2xl"
              >{text("title")}</Heading
            >
            <section id="profile" class={section}>
              {@render head(text("profile"))}
              <div class={card}>
                <div class={rowClass}>
                  <div class="flex min-w-0 items-center gap-3">
                    <PersonAvatar
                      size="lg"
                      email={$view.me.email}
                      version={$view.me.avatar}
                    />
                    <div class="min-w-0 break-words">
                      <p class="m-0 font-medium">
                        {$view.me.name || $view.me.email}
                      </p>
                      <p class={hint}>{$view.me.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onclick={(event) => {
                      if (live(event, rendered)) photo?.click();
                    }}>{en ? "Change photo" : "Trocar foto"}</Button
                  ><input
                    bind:this={photo}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label={en ? "Profile photo" : "Foto do perfil"}
                    class="sr-only"
                    onchange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (live(event, rendered) && file && !busy)
                        owner.photo((current) => avatarImage(file, current));
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
                <form
                  class={rowClass}
                  onsubmit={(event) => {
                    event.preventDefault();
                    if (live(event, rendered) && !busy) owner.rename(name);
                  }}
                >
                  <Label for="account-name" class="font-normal"
                    >{en ? "Your name" : "Seu nome"}</Label
                  >
                  <div class="flex w-full gap-2 md:w-auto">
                    <!-- Not a login field: password managers stay out of it. -->
                    <Input
                      id="account-name"
                      value={name}
                      oninput={(event) => {
                        if (live(event, rendered))
                          name = event.currentTarget.value;
                      }}
                      required
                      maxlength={60}
                      autocomplete="off"
                      data-1p-ignore
                      data-bwignore
                      data-lpignore="true"
                      data-form-type="other"
                      disabled={busy}
                      class="h-9 min-w-0 flex-1 md:w-56"
                    /><Button
                      type="submit"
                      size="sm"
                      class="h-9"
                      disabled={busy || name === lastName}
                      >{en ? "Save" : "Salvar"}</Button
                    >
                  </div>
                </form>
                {#if $view.phase === "pending" || $view.phase === "confirming"}<p
                    role="status"
                    class="m-0 px-4 py-3 text-sm text-muted-foreground"
                  >
                    {en
                      ? "Waiting for confirmation…"
                      : "Esperando confirmação…"}
                  </p>{/if}
                {#if $view.phase === "error"}<p
                    role="alert"
                    class="m-0 px-4 py-3 text-sm text-destructive"
                  >
                    {en
                      ? "Could not save this change. Check the details and try again."
                      : "Não deu para salvar esta mudança. Confira os dados e tente de novo."}
                  </p>{/if}
                {#if $view.phase === "unconfirmed"}<div
                    role="alert"
                    class="flex flex-col gap-2 px-4 py-3 text-sm"
                  >
                    <p class="m-0">
                      {en
                        ? "This change is unconfirmed. It may have been saved. Refresh before trying again."
                        : "Esta mudança não foi confirmada. Ela pode ter sido salva. Atualize antes de tentar de novo."}
                    </p>
                    <div class="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onclick={(event) => {
                          if (live(event, rendered)) owner.refresh();
                        }}>{en ? "Refresh" : "Atualizar"}</Button
                      ><Button
                        variant="outline"
                        size="sm"
                        onclick={(event) => {
                          if (live(event, rendered)) owner.review();
                        }}
                        >{en
                          ? "Review and try again"
                          : "Revisar e tentar de novo"}</Button
                      >
                    </div>
                  </div>{/if}
              </div>
            </section>
            <section class={section} aria-labelledby="settings-signin">
              <div class="flex flex-col gap-0.5 px-1">
                <Heading
                  level={3}
                  id="settings-signin"
                  class="m-0 font-sans text-[0.9375rem] font-semibold"
                  >{en ? "How you sign in" : "Como você entra"}</Heading
                >
              </div>
              <div class={card}>
                {#if $view.loginsLoading}<p
                    role="status"
                    class="m-0 px-4 py-3 text-muted-foreground"
                  >
                    {en ? "Loading…" : "Carregando…"}
                  </p>{:else if $view.loginsError}<div class={rowClass}>
                    <p role="alert" class="m-0">
                      {en
                        ? "Could not load sign-in history."
                        : "Não deu para carregar o histórico de entrada."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onclick={(event) => {
                        if (live(event, rendered)) owner.logins();
                      }}>{en ? "Retry" : "Tentar de novo"}</Button
                    >
                  </div>{:else if $view.logins}<ul
                    class="m-0 list-none divide-y divide-border p-0"
                  >
                    {#each loginRows as row}{@const used =
                        $view.logins.logins.find(
                          (item) => item.method === row.method,
                        )}
                      <li class={rowClass}>
                        <span>{row.label}</span><span
                          class="text-xs text-muted-foreground"
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
              </div>
            </section>
            <section id="agents" data-native-account-agents class={section}>
              {@render head(text("agents"))}
              {@render agentSettings()}
            </section>
            <section id="cloud" class={section}>
              {@render head(text("cloud"))}
              <div class="{card} p-4">{@render cloud()}</div>
            </section>
            <section id="device" class={section}>
              {@render head(text("device"))}
              <div class={card}>
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
                <label class="{rowClass} cursor-pointer">
                  <div class="flex min-w-0 flex-col gap-0.5">
                    <span id="settings-lock"
                      >{en
                        ? "Require Face ID when opening"
                        : "Exigir Face ID ao abrir"}</span
                    >
                    {#if !$lock.supported}<p class={hint}>
                        {en
                          ? "Unavailable in this browser."
                          : "Não disponível neste navegador."}
                      </p>{/if}
                    {#if $lock.error}<p
                        role="alert"
                        class="m-0 text-xs text-destructive"
                      >
                        {en
                          ? "Device authentication was cancelled or failed. Try again."
                          : "A autenticação do aparelho foi cancelada ou falhou. Tente de novo."}
                      </p>{/if}
                  </div>
                  <Switch
                    aria-labelledby="settings-lock"
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
                  />
                </label>
              </div>
            </section>
            <section class={section} aria-label={en ? "Account" : "Conta"}>
              {@render head(en ? "Account" : "Conta")}
              <div class={card}>
                <div class={rowClass}>
                  <span>{en ? "Archived rooms" : "Salas arquivadas"}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={(event) => {
                      if (live(event, rendered)) onArchive();
                    }}>{en ? "Open" : "Abrir"}</Button
                  >
                </div>
                <div class={rowClass}>
                  <span
                    >{en
                      ? "Sign out of this device"
                      : "Sair deste aparelho"}</span
                  >
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={(event) => {
                      if (live(event, rendered)) onLogout(false);
                    }}>{en ? "Sign out" : "Sair"}</Button
                  >
                </div>
                <div class={rowClass}>
                  <div class="flex min-w-0 flex-col gap-0.5">
                    <span
                      >{en
                        ? "Sign out on every device"
                        : "Sair de todos os aparelhos"}</span
                    >
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    class="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onclick={(event) => {
                      if (live(event, rendered) && $view.me)
                        logoutAll = {
                          account: $view.me.email,
                          binding: rendered,
                        };
                    }}>{en ? "Sign out everywhere" : "Sair de tudo"}</Button
                  >
                </div>
              </div>
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
