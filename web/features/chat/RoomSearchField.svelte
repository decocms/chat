<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Popover from "../../lib/studio/Popover.svelte";
  import PopoverContent from "../../lib/studio/PopoverContent.svelte";
  import PopoverTrigger from "../../lib/studio/PopoverTrigger.svelte";
  import Command from "../../lib/studio/Command.svelte";
  import CommandEmpty from "../../lib/studio/CommandEmpty.svelte";
  import CommandGroup from "../../lib/studio/CommandGroup.svelte";
  import CommandInput from "../../lib/studio/CommandInput.svelte";
  import CommandItem from "../../lib/studio/CommandItem.svelte";
  import CommandList from "../../lib/studio/CommandList.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { NO_SEARCH, personMatch, type SearchFilter } from "./roomSearch";
  /**
   * The room's search field: the words, and a person picked from the room's members ("Filtrar por pessoa"). The
   * person shows as a chip before the words. Esc and the × clear both; Backspace in an empty field takes the person
   * out. Desktop draws it in the top bar; a phone draws it at the top of the Search pane (docs/design.md).
   */
  let {
    value,
    onchange,
    members,
    me,
    placeholder,
    vb,
    focus = false,
    class: className = "",
  }: {
    value: SearchFilter;
    onchange: (next: SearchFilter) => void;
    members: readonly string[];
    me: string;
    placeholder: string;
    vb: {
      t: (text: string, vars?: Record<string, string | number>) => string;
      name: (email: string) => string;
      avatarVersion: (email: string) => number | null | undefined;
    };
    /** Takes the focus when it is drawn (the phone's Search pane). */
    focus?: boolean;
    class?: string;
  } = $props();
  let open = $state(false),
    field = $state<HTMLInputElement | null>(null);
  const people = $derived(
    [...members]
      .map((email) => ({ email, name: vb.name(email) || email }))
      .sort((a, b) =>
        a.email === me ? -1 : b.email === me ? 1 : a.name.localeCompare(b.name),
      ),
  );
  const personName = $derived(
    value.person ? (vb.name(value.person) || value.person).split(/\s+/)[0] : "",
  );
  $effect(() => {
    if (focus) field?.focus();
  });
  function pick(email: string) {
    open = false;
    onchange({ ...value, person: email === value.person ? "" : email });
    queueMicrotask(() => field?.focus());
  }
</script>

<div
  data-room-search-field
  class={[
    "flex shrink-0 items-center gap-1.5 rounded-lg bg-muted text-muted-foreground focus-within:text-foreground",
    className,
  ]}
>
  <Icon icon="search-md" size={14} class="shrink-0" />{#if value.person}<span
      data-search-person={value.person}
      class="inline-flex h-6 max-w-32 shrink-0 items-center gap-1 rounded-full bg-background pr-0.5 pl-1 text-xs text-foreground shadow-edge"
      ><PersonAvatar
        email={value.person}
        version={vb.avatarVersion(value.person)}
        size="2xs"
        class="size-4"
      /><span class="truncate">{personName}</span><IconButton
        label={vb.t("Tirar {name} da busca", { name: personName })}
        tooltipSide="bottom"
        size="icon-xs"
        class="size-5 rounded-full text-muted-foreground hover:text-foreground"
        onclick={() => {
          onchange({ ...value, person: "" });
          field?.focus();
        }}><Icon icon="x" size={12} /></IconButton
      ></span
    >{/if}<input
    bind:this={field}
    type="text"
    inputmode="search"
    value={value.text}
    placeholder={value.person ? vb.t("Buscar palavras") : placeholder}
    aria-label={placeholder}
    class="h-full min-w-0 flex-1 border-0 bg-transparent font-sans text-sm text-foreground outline-none placeholder:text-muted-foreground"
    oninput={(event) => onchange({ ...value, text: event.currentTarget.value })}
    onkeydown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onchange(NO_SEARCH);
        event.currentTarget.blur();
      } else if (
        event.key === "Backspace" &&
        value.person &&
        !event.currentTarget.value
      ) {
        event.preventDefault();
        onchange({ ...value, person: "" });
      }
    }}
  />{#if value.text || value.person}<IconButton
      label={vb.t("Limpar busca")}
      tooltipSide="bottom"
      size="icon-xs"
      class="text-muted-foreground hover:text-foreground"
      onclick={() => onchange(NO_SEARCH)}
      ><Icon icon="x" size={14} /></IconButton
    >{/if}<Popover bind:open>
    <PopoverTrigger>
      {#snippet child({ props })}<IconButton
          {...props}
          label={vb.t("Filtrar por pessoa")}
          tooltipSide="bottom"
          size="icon-xs"
          data-search-people
          class={value.person
            ? "-mr-1.5 text-foreground hover:text-foreground"
            : "-mr-1.5 text-muted-foreground hover:text-foreground"}
          ><Icon icon="user-01" size={14} /></IconButton
        >{/snippet}
    </PopoverTrigger>
    <PopoverContent
      align="end"
      class="w-64 max-w-[calc(100vw-16px)] p-0 font-sans"
      data-search-people-list
    >
      <Command filter={personMatch}>
        <CommandInput
          size="sm"
          placeholder={vb.t("Buscar pessoa…")}
          aria-label={vb.t("Buscar pessoa…")}
        />
        <CommandList>
          <CommandEmpty>{vb.t("Ninguém com esse nome")}</CommandEmpty>
          <CommandGroup>
            {#each people as person (person.email)}<CommandItem
                value={`${person.name} ${person.email}`}
                data-search-person-option={person.email}
                onSelect={() => pick(person.email)}
                ><PersonAvatar
                  email={person.email}
                  version={vb.avatarVersion(person.email)}
                  size="xs"
                  class="size-6"
                /><span class="min-w-0 flex-1 truncate"
                  >{person.name}{#if person.email === me}<span
                      class="text-muted-foreground">{` · ${vb.t("Você")}`}</span
                    >{/if}</span
                ><Icon
                  icon="check"
                  class={value.person === person.email
                    ? "opacity-100"
                    : "opacity-0"}
                /></CommandItem
              >{/each}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</div>
