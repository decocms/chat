<script lang="ts">
  import { tick } from "svelte";
  import Avatar from "../../lib/ui/Avatar.svelte";
  import Button from "../../lib/ui/Button.svelte";
  import Separator from "../../lib/ui/Separator.svelte";
  import { cn } from "../../lib/ui/utils";
  import { homeText, type HomeLanguage } from "../home/copy";
  import ThemeIcon from "./ThemeIcon.svelte";
  type Theme = "auto" | "light" | "dark";
  /**
   * The person's avatar at the end of the rail. It opens a popover with who is
   * signed in and the language and theme settings.
   */
  let {
    name,
    email,
    avatar,
    lang,
    theme,
    onsettheme,
    onlanguage,
  }: {
    name: string;
    email: string;
    avatar?: string;
    lang: HomeLanguage;
    theme: Theme;
    onsettheme: (theme: Theme) => void;
    onlanguage: (lang: HomeLanguage) => void;
  } = $props();
  const text = (key: Parameters<typeof homeText>[1]) => homeText(lang, key);
  const themes: {
    value: Theme;
    label: "themeAuto" | "themeLight" | "themeDark";
  }[] = [
    { value: "light", label: "themeLight" },
    { value: "dark", label: "themeDark" },
    { value: "auto", label: "themeAuto" },
  ];
  let open = $state(false);
  let root = $state<HTMLElement | null>(null);
  let trigger = $state<HTMLButtonElement | null>(null);
  let panel = $state<HTMLElement | null>(null);
  const label = $derived(name || email);
  function close(returnFocus = false) {
    if (!open) return;
    open = false;
    if (returnFocus) trigger?.focus();
  }
  $effect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root?.contains(event.target))
        close();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  });
</script>

<div
  bind:this={root}
  role="presentation"
  class="tw:relative tw:shrink-0"
  onkeydown={(event) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      close(true);
    }
  }}
  onfocusout={(event) => {
    if (
      open &&
      event.relatedTarget instanceof Node &&
      !root?.contains(event.relatedTarget)
    )
      close();
  }}
>
  <button
    bind:this={trigger}
    type="button"
    aria-label={label}
    title={label}
    aria-haspopup="dialog"
    aria-expanded={open}
    class="tw:group tw:relative tw:flex tw:size-12 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-control tw:outline-none tw:ring-inset tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:aria-expanded:ring-2 tw:aria-expanded:ring-primary"
    onclick={() => {
      open = !open;
      if (open) void tick().then(() => panel?.focus());
    }}
  >
    <Avatar
      name={label}
      src={avatar}
      class="tw:size-10 tw:text-sm tw:transition-opacity tw:group-hover:opacity-80 tw:motion-reduce:transition-none"
    />
  </button>
  {#if open}<div
      bind:this={panel}
      role="dialog"
      aria-label={text("userMenu")}
      tabindex="-1"
      class={cn(
        "tw:absolute tw:z-50 tw:grid tw:w-64 tw:max-w-[calc(100vw-1rem)] tw:gap-3 tw:rounded-surface tw:border tw:border-border tw:bg-popover tw:p-3 tw:font-sans tw:text-sm tw:text-popover-foreground tw:shadow-lg tw:outline-none",
        "tw:right-0 tw:top-full tw:mt-2 tw:min-[901px]:right-auto tw:min-[901px]:top-auto tw:min-[901px]:bottom-0 tw:min-[901px]:left-full tw:min-[901px]:mt-0 tw:min-[901px]:ml-2",
      )}
    >
      <div class="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
        <Avatar name={label} src={avatar} class="tw:size-10 tw:text-sm" />
        <div class="tw:min-w-0">
          <div class="tw:truncate tw:font-semibold">{label}</div>
          {#if name && name !== email}<div
              class="tw:truncate tw:text-xs tw:text-muted-foreground"
            >
              {email}
            </div>{/if}
        </div>
      </div>
      <Separator />
      <div class="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span class="tw:text-muted-foreground">{text("language")}</span>
        <div
          class="tw:flex tw:items-center tw:gap-1"
          role="group"
          aria-label={text("language")}
        >
          {#each [{ value: "pt", label: "PT" }, { value: "en", label: "EN" }] as const as option (option.value)}<Button
              variant={lang === option.value ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={lang === option.value}
              onclick={() => {
                if (lang !== option.value) onlanguage(option.value);
              }}>{option.label}</Button
            >{/each}
        </div>
      </div>
      <div class="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span class="tw:text-muted-foreground">{text("theme")}</span>
        <div
          class="tw:flex tw:items-center tw:gap-1"
          role="group"
          aria-label={text("theme")}
        >
          {#each themes as option (option.value)}<Button
              variant={theme === option.value ? "secondary" : "ghost"}
              size="sm"
              class="tw:w-8 tw:px-0"
              aria-pressed={theme === option.value}
              aria-label={text(option.label)}
              title={text(option.label)}
              onclick={() => {
                if (theme !== option.value) onsettheme(option.value);
              }}><ThemeIcon theme={option.value} /></Button
            >{/each}
        </div>
      </div>
    </div>{/if}
</div>
