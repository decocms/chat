<script lang="ts">
  import PersonAvatar from "../lib/components/PersonAvatar.svelte";
  import AgentMark from "../lib/components/AgentMark.svelte";
  import Heading from "../lib/ui/Heading.svelte";
  import Badge from "../lib/studio/Badge.svelte";
  import Button from "../lib/studio/Button.svelte";
  import Card from "../lib/studio/Card.svelte";
  import CardDescription from "../lib/studio/CardDescription.svelte";
  import CardHeader from "../lib/studio/CardHeader.svelte";
  import CardTitle from "../lib/studio/CardTitle.svelte";
  import Checkbox from "../lib/studio/Checkbox.svelte";
  import Dialog from "../lib/studio/Dialog.svelte";
  import DialogContent from "../lib/studio/DialogContent.svelte";
  import DialogDescription from "../lib/studio/DialogDescription.svelte";
  import DialogFooter from "../lib/studio/DialogFooter.svelte";
  import DialogHeader from "../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../lib/studio/DialogTitle.svelte";
  import DialogTrigger from "../lib/studio/DialogTrigger.svelte";
  import Icon from "../lib/studio/Icon.svelte";
  import IconButton from "../lib/studio/IconButton.svelte";
  import Input from "../lib/studio/Input.svelte";
  import Label from "../lib/studio/Label.svelte";
  import RadioGroup from "../lib/studio/RadioGroup.svelte";
  import RadioGroupItem from "../lib/studio/RadioGroupItem.svelte";
  import Select from "../lib/studio/Select.svelte";
  import SelectContent from "../lib/studio/SelectContent.svelte";
  import SelectItem from "../lib/studio/SelectItem.svelte";
  import SelectTrigger from "../lib/studio/SelectTrigger.svelte";
  import SelectValue from "../lib/studio/SelectValue.svelte";
  import Separator from "../lib/studio/Separator.svelte";
  import Sheet from "../lib/studio/Sheet.svelte";
  import SheetContent from "../lib/studio/SheetContent.svelte";
  import SheetDescription from "../lib/studio/SheetDescription.svelte";
  import SheetHeader from "../lib/studio/SheetHeader.svelte";
  import SheetTitle from "../lib/studio/SheetTitle.svelte";
  import SheetTrigger from "../lib/studio/SheetTrigger.svelte";
  import Skeleton from "../lib/studio/Skeleton.svelte";
  import Spinner from "../lib/studio/Spinner.svelte";
  import Switch from "../lib/studio/Switch.svelte";
  import Tabs from "../lib/studio/Tabs.svelte";
  import TabsContent from "../lib/studio/TabsContent.svelte";
  import TabsList from "../lib/studio/TabsList.svelte";
  import TabsTrigger from "../lib/studio/TabsTrigger.svelte";
  import Textarea from "../lib/studio/Textarea.svelte";
  import Tooltip from "../lib/studio/Tooltip.svelte";
  import TooltipContent from "../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../lib/studio/TooltipTrigger.svelte";
  import { Moon01, Plus, SearchMd, Sun } from "../lib/studio/icons";
  import Field from "../lib/components/Field.svelte";
  import EmptyState from "../lib/components/EmptyState.svelte";
  import ErrorState from "../lib/components/ErrorState.svelte";
  import LoadingState from "../lib/components/LoadingState.svelte";

  let theme = $state<"light" | "dark">("light");
  let text = $state("");
  let notes = $state("");
  let checked = $state(false);
  let enabled = $state(false);
  let choice = $state("room");
  let selected = $state("general");
  let filter = $state("all");
  let count = $state(0);
  let status = $state("");
  $effect(() => {
    document.documentElement.dataset.theme = theme;
  });
  const variants = [
    "default",
    "secondary",
    "outline",
    "ghost",
    "destructive",
    "link",
  ] as const;
  const visibility = [
    { value: "room", label: "Room members" },
    { value: "personal", label: "Only me" },
    { value: "disabled", label: "Unavailable", disabled: true },
  ];
  const filters = [
    { value: "all", label: "All rooms" },
    { value: "active", label: "Active rooms" },
  ];
  const settings = [
    { value: "general", label: "General" },
    { value: "members", label: "Members" },
    { value: "disabled", label: "Unavailable", disabled: true },
  ];
  const overlay = "tw:font-sans tw:text-sm tw:text-foreground";
</script>

<main
  data-vb-native
  class="tw:m-0 tw:box-border tw:min-h-dvh tw:bg-background tw:px-4 tw:py-8 tw:font-sans tw:text-sm tw:font-normal tw:leading-5 tw:text-foreground tw:sm:px-8"
  data-gallery
>
  <div class="tw:mx-auto tw:max-w-6xl tw:space-y-6">
    <header
      class="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-4"
    >
      <div class="tw:space-y-2">
        <a
          href="/app?ui=svelte"
          class="tw:text-sm tw:text-foreground tw:underline tw:decoration-current/35 tw:underline-offset-4 tw:hover:decoration-current"
          >vibebook</a
        >
        <h1
          class="tw:m-0 tw:font-sans tw:text-2xl tw:font-semibold tw:leading-8 tw:tracking-tight"
        >
          Component gallery
        </h1>
        <p class="tw:m-0 tw:text-muted-foreground">
          Shared primitives, Studio tokens, and one Tailwind entry.
        </p>
      </div>
      <div class="tw:flex tw:items-center tw:gap-2">
        <IconButton
          label={theme === "light" ? "Use dark theme" : "Use light theme"}
          variant="outline"
          onclick={() => (theme = theme === "light" ? "dark" : "light")}
          ><Icon icon={theme === "light" ? Moon01 : Sun} /></IconButton
        ><Badge>{theme}</Badge>
      </div>
    </header>
    <div class="tw:grid tw:grid-cols-1 tw:gap-5 tw:md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription
            >Variants share focus, disabled and loading behavior.</CardDescription
          >
        </CardHeader>
        <div class="tw:flex tw:flex-wrap tw:gap-2">
          {#each variants as variant}<Button
              {variant}
              onclick={() => {
                count += 1;
                status = `${variant} activated`;
              }}>{variant}</Button
            >{/each}
        </div>
        <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <Button disabled>Disabled</Button><Button disabled aria-busy="true"
            ><Spinner size="xs" />Saving</Button
          ><Button size="sm" variant="outline">Small</Button><IconButton
            label="Add item"
            onclick={() => (count += 1)}><Icon icon={Plus} /></IconButton
          ><Tooltip>
            <TooltipTrigger>
              {#snippet child({ props })}<Button
                  {...props}
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Search rooms"><Icon icon={SearchMd} /></Button
                >{/snippet}
            </TooltipTrigger>
            <TooltipContent>Search rooms</TooltipContent>
          </Tooltip>
        </div>
        <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
          Actions: {count}
        </p>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
          <CardDescription
            >Labels, hints and errors have explicit associations.</CardDescription
          >
        </CardHeader>
        <Field
          id="gallery-title"
          label="Room name"
          hint="Choose a name your team recognizes."
          >{#snippet children(props)}<Input
              {...props}
              bind:value={text}
              placeholder="Project room"
            />{/snippet}</Field
        >
        <Field
          id="gallery-email"
          label="Email"
          error="Enter a valid email address."
          >{#snippet children(props)}<Input
              {...props}
              type="email"
              value="invalid"
            />{/snippet}</Field
        >
        <Field id="gallery-notes" label="Notes"
          >{#snippet children(props)}<Textarea
              {...props}
              bind:value={notes}
              placeholder="Write a note"
            />{/snippet}</Field
        >
        <Field id="gallery-disabled" label="Unavailable"
          >{#snippet children(props)}<Input
              {...props}
              disabled
              value="Disabled input"
            />{/snippet}</Field
        >
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Selection</CardTitle>
          <CardDescription
            >Keyboard controls use native semantics or Bits UI behavior.</CardDescription
          >
        </CardHeader>
        <div class="tw:flex tw:items-center tw:gap-2">
          <Checkbox id="gallery-checkbox" bind:checked /><Label
            for="gallery-checkbox">Include archived rooms</Label
          >
        </div>
        <div class="tw:flex tw:items-center tw:gap-2">
          <Switch id="gallery-switch" bind:checked={enabled} /><Label
            for="gallery-switch">Notifications</Label
          >
        </div>
        <RadioGroup aria-label="Room visibility" bind:value={choice}>
          {#each visibility as item (item.value)}
            <div class="tw:flex tw:items-center tw:gap-2">
              <RadioGroupItem
                id={`gallery-radio-${item.value}`}
                value={item.value}
                disabled={item.disabled}
              /><Label for={`gallery-radio-${item.value}`}>{item.label}</Label>
            </div>
          {/each}
        </RadioGroup>
        <Field id="gallery-filter" label="Show"
          >{#snippet children(props)}<Select
              items={filters}
              bind:value={filter}
            >
              <SelectTrigger {...props} class="tw:w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent data-vb-native class="tw:font-sans">
                {#each filters as item (item.value)}<SelectItem
                    value={item.value}
                    label={item.label}>{item.label}</SelectItem
                  >{/each}
              </SelectContent>
            </Select>{/snippet}</Field
        >
        <output
          data-selection-state
          class="tw:block tw:text-xs tw:text-muted-foreground"
          aria-live="polite">{choice} · {filter}</output
        >
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Overlays</CardTitle>
          <CardDescription
            >Focus trap, Escape dismissal and focus restoration are provided by
            Bits UI.</CardDescription
          >
        </CardHeader>
        <div class="tw:flex tw:flex-wrap tw:gap-2">
          <Dialog>
            <DialogTrigger>
              {#snippet child({ props })}<Button {...props} variant="outline"
                  >Open dialog</Button
                >{/snippet}
            </DialogTrigger>
            <DialogContent
              data-vb-native
              class={overlay}
              closeLabel="Close dialog"
              preventScroll={false}
              preventBodyPointerEvents={false}
              preventOverflowTextSelection={false}
            >
              <DialogHeader>
                <DialogTitle class="tw:font-sans">Edit room</DialogTitle>
                <DialogDescription
                  >Changes apply to the current room.</DialogDescription
                >
              </DialogHeader>
              <Field id="dialog-name" label="Name"
                >{#snippet children(props)}<Input
                    {...props}
                    bind:value={text}
                  />{/snippet}</Field
              >
              <DialogFooter>
                <Button onclick={() => (status = "Dialog action completed")}
                  >Save name</Button
                >
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger>
              {#snippet child({ props })}<Button {...props} variant="outline"
                  >Open sheet</Button
                >{/snippet}
            </SheetTrigger>
            <SheetContent
              data-vb-native
              class={overlay}
              preventScroll={false}
              preventBodyPointerEvents={false}
              preventOverflowTextSelection={false}
            >
              <SheetHeader>
                <SheetTitle class="tw:font-sans">Room details</SheetTitle>
                <SheetDescription
                  >A responsive sheet shares the dialog behavior.</SheetDescription
                >
              </SheetHeader>
              <div class="tw:grid tw:gap-4 tw:px-4">
                <p class="tw:m-0 tw:text-muted-foreground">
                  The same dialog primitives support mobile and desktop layouts.
                </p>
                <Input aria-label="Sheet note" placeholder="Add a note" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <Tabs bind:value={selected}>
          <TabsList aria-label="Room settings">
            {#each settings as item (item.value)}<TabsTrigger
                value={item.value}
                disabled={item.disabled}>{item.label}</TabsTrigger
              >{/each}
          </TabsList>
          {#each settings as item (item.value)}<TabsContent value={item.value}
              ><p
                class="tw:m-0 tw:rounded-control tw:border tw:border-border tw:p-3"
              >
                {item.value === "general" ? "General settings" : "Room members"}
              </p></TabsContent
            >{/each}
        </Tabs>
      </Card>
      <Card>
        <CardHeader><CardTitle>Identity and feedback</CardTitle></CardHeader>
        <div class="tw:flex tw:items-center tw:gap-3">
          <PersonAvatar size="sm" email="ana@example.com" /><PersonAvatar
            size="sm"
            email="bruno@example.com"
          /><PersonAvatar size="sm" email="sample@example.com" /><AgentMark
            via="claude-opus-5-5"
          /><AgentMark via="codex" /><span class="tw:text-muted-foreground"
            >People are round faces; agents are square marks.</span
          >
        </div>
        <Separator />
        <div class="tw:flex tw:flex-wrap tw:gap-2">
          <Badge>Default</Badge><Badge variant="brand">Selected</Badge><Badge
            class="tw:text-foreground"
            variant="success">Complete</Badge
          ><Badge class="tw:text-foreground" variant="warning">Waiting</Badge
          ><Badge class="tw:text-foreground" variant="destructive">Failed</Badge
          >
        </div>
        <div class="tw:flex tw:items-center tw:gap-3">
          <Skeleton class="tw:size-9 tw:rounded-full" />
          <div class="tw:flex-1 tw:space-y-2">
            <Skeleton class="tw:h-3 tw:w-3/4" /><Skeleton
              class="tw:h-3 tw:w-1/2"
            />
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader><CardTitle>Empty states</CardTitle></CardHeader><EmptyState
          title="Nothing waiting for you"
          description="New requests and tasks in review will appear here."
          ><Button
            variant="outline"
            onclick={() => (status = "Empty state action completed")}
            >Explore rooms</Button
          ></EmptyState
        ></Card
      >
      <Card>
        <CardHeader><CardTitle>Status feedback</CardTitle></CardHeader
        ><LoadingState label="Saving changes" /><ErrorState
          title="Could not save changes"
          description="Your draft is still available."
          retryLabel="Try again"
          onretry={() => (status = "Retry requested")}
        /></Card
      >
      <Card class="tw:md:col-span-2">
        <CardHeader><CardTitle>Typography</CardTitle></CardHeader>
        <Heading level={3} class="tw:text-xl tw:leading-7 tw:tracking-tight">
          Inter variable — headings and UI
        </Heading>
        <p class="tw:m-0 tw:text-sm tw:leading-5">
          Body 400 · medium 500 · semibold 500 · bold 600. English and
          Portuguese: Olá, colaboração, ações.
        </p>
        <p class="tw:m-0 tw:text-muted-foreground">
          Muted text uses the Studio semantic role.
        </p>
        <pre
          class="tw:m-0 tw:overflow-auto tw:rounded-control tw:border tw:border-border tw:bg-muted tw:p-3 tw:font-mono tw:text-sm tw:leading-6"><code
            >const room = "fully typed";</code
          ></pre>
      </Card>
    </div>
    <p role="status" class="tw:min-h-5 tw:text-sm tw:text-muted-foreground">
      {status}
    </p>
  </div>
</main>
