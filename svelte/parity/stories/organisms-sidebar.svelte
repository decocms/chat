<script lang="ts" module>
  export const layouts = {
    "project-first": "fullscreen",
    default: "fullscreen",
    collapsed: "fullscreen",
    loading: "fullscreen",
  };
</script>

<script lang="ts">
  import Avatar from "../../lib/studio/Avatar.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import {
    BarChartSquare02,
    BookOpen01,
    ChevronDown,
    ChevronSelectorVertical,
    Columns03,
    Folder,
    Globe02,
    Home02,
    Inbox01,
    MessageCircle01,
    Plus,
    Rocket01,
    Settings02,
    Zap,
    type IconNode,
  } from "../../lib/studio/icons";
  import ProjectIcon from "../../lib/studio/ProjectIcon.svelte";
  import Sidebar from "../../lib/studio/Sidebar.svelte";
  import SidebarContent from "../../lib/studio/SidebarContent.svelte";
  import SidebarFooter from "../../lib/studio/SidebarFooter.svelte";
  import SidebarGroup from "../../lib/studio/SidebarGroup.svelte";
  import SidebarGroupContent from "../../lib/studio/SidebarGroupContent.svelte";
  import SidebarHeader from "../../lib/studio/SidebarHeader.svelte";
  import SidebarInset from "../../lib/studio/SidebarInset.svelte";
  import SidebarLayout from "../../lib/studio/SidebarLayout.svelte";
  import SidebarMenu from "../../lib/studio/SidebarMenu.svelte";
  import SidebarMenuButton from "../../lib/studio/SidebarMenuButton.svelte";
  import SidebarMenuItem from "../../lib/studio/SidebarMenuItem.svelte";
  import SidebarMenuSkeleton from "../../lib/studio/SidebarMenuSkeleton.svelte";
  import SidebarProvider from "../../lib/studio/SidebarProvider.svelte";
  import SidebarTrigger from "../../lib/studio/SidebarTrigger.svelte";
  import TooltipProvider from "../../lib/studio/TooltipProvider.svelte";

  let { story }: { story: string } = $props();

  type Color = "blue" | "purple" | "green" | "red";
  type NavItem = { label: string; icon: IconNode; active?: boolean };
  type Project = {
    name: string;
    color: Color;
    icon: IconNode;
    tasks?: string[];
    waiting?: boolean;
  };

  const navItems: NavItem[] = [
    { label: "Home", icon: Home02, active: true },
    { label: "Deco Score", icon: BarChartSquare02 },
    { label: "Board", icon: Columns03 },
    { label: "Library", icon: Folder },
    { label: "Settings", icon: Settings02 },
  ];

  const projects: Project[] = [
    {
      name: "Storefront",
      color: "blue",
      icon: Globe02,
      tasks: ["Fix the checkout banner", "Alt text on product pages"],
    },
    { name: "Blog", color: "purple", icon: BookOpen01, tasks: [] },
    { name: "Sales app", color: "green", icon: Zap, tasks: [] },
  ];

  const orgs = [
    { name: "Acme", active: true },
    { name: "Casa Aurora" },
    { name: "Northwind" },
  ];

  const destinations: NavItem[] = [
    { label: "Today", icon: Home02, active: true },
    { label: "Tasks", icon: Columns03 },
    { label: "Agents", icon: Zap },
    { label: "Library", icon: Folder },
  ];

  const folders: { name: string; projects: Project[] }[] = [
    {
      name: "Pinned",
      projects: [
        { name: "Storefront", color: "blue", icon: Globe02, waiting: true },
      ],
    },
    {
      name: "Marketing",
      projects: [
        { name: "Blog", color: "purple", icon: BookOpen01 },
        { name: "Landing pages", color: "red", icon: Rocket01 },
      ],
    },
  ];
</script>

{#snippet appSidebar()}
  <Sidebar class="tw:pt-1.5">
    <SidebarHeader
      class="tw:h-12 tw:flex-row tw:items-center tw:gap-1 tw:px-2 tw:py-0 tw:group-data-[state=collapsed]/sidebar:h-auto tw:group-data-[state=collapsed]/sidebar:flex-col"
    >
      <button
        type="button"
        class="tw:hover:bg-sidebar-accent tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:flex tw:min-w-0 tw:flex-1 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:py-1.5 tw:pr-1.5 tw:pl-2 tw:group-data-[state=collapsed]/sidebar:flex-none tw:group-data-[state=collapsed]/sidebar:p-0"
      >
        <Avatar fallback="Acme" size="xs" muted />
        <span
          class="tw:min-w-0 tw:flex-1 tw:truncate tw:text-left tw:text-sm tw:font-medium tw:group-data-[state=collapsed]/sidebar:hidden"
        >
          Acme
        </span>
      </button>
      <SidebarTrigger class="tw:group-data-[state=collapsed]/sidebar:mx-auto" />
      <IconButton
        label="New chat"
        class="tw:group-data-[state=collapsed]/sidebar:hidden"
      >
        <Icon icon={MessageCircle01} />
      </IconButton>
    </SidebarHeader>
    <SidebarContent class="tw:gap-6 tw:px-2 tw:pt-3 tw:pb-2">
      <SidebarMenu class="tw:gap-1">
        {#each navItems as item (item.label)}
          <SidebarMenuItem>
            <SidebarMenuButton isActive={item.active} tooltip={item.label}>
              <Icon icon={item.icon} />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        {/each}
      </SidebarMenu>
      <div
        class="tw:flex tw:flex-col tw:gap-2 tw:group-data-[state=collapsed]/sidebar:hidden"
      >
        <p
          class="tw:text-muted-foreground tw:px-2 tw:text-xs tw:font-medium tw:text-pretty"
        >
          Projects
        </p>
        <SidebarMenu class="tw:gap-1">
          {#each projects as project (project.name)}
            {@const tasks = project.tasks ?? []}
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={project.name}>
                <ProjectIcon color={project.color} size="sm">
                  <Icon icon={project.icon} />
                </ProjectIcon>
                <span>{project.name}</span>
              </SidebarMenuButton>
              {#if tasks.length > 0}
                <ul class="tw:flex tw:flex-col">
                  {#each tasks as task, index (task)}
                    <li class="tw:relative">
                      <span
                        aria-hidden="true"
                        class="tw:border-sidebar-border tw:absolute tw:top-0 tw:left-4 tw:h-1/2 tw:w-3 tw:rounded-bl-lg tw:border-b tw:border-l"
                      ></span>
                      {#if index < tasks.length - 1}
                        <span
                          aria-hidden="true"
                          class="tw:border-sidebar-border tw:absolute tw:top-1/2 tw:bottom-0 tw:left-4 tw:border-l"
                        ></span>
                      {/if}
                      <a
                        href="#task"
                        class="tw:text-sidebar-foreground/70 tw:hover:bg-sidebar-accent tw:hover:text-sidebar-foreground tw:flex tw:h-8 tw:items-center tw:rounded-lg tw:pr-2 tw:pl-9 tw:text-sm tw:transition-colors"
                      >
                        <span class="tw:truncate">{task}</span>
                      </a>
                    </li>
                  {/each}
                </ul>
              {/if}
            </SidebarMenuItem>
          {/each}
          <SidebarMenuItem>
            <SidebarMenuButton class="tw:text-muted-foreground">
              <Icon icon={Plus} />
              <span>Add project</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </SidebarContent>
    <SidebarFooter class="tw:gap-0.5 tw:px-2 tw:pb-3">
      <div
        class="tw:flex tw:items-center tw:gap-1 tw:group-data-[state=collapsed]/sidebar:flex-col"
      >
        <button
          type="button"
          class="tw:hover:bg-sidebar-accent tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:flex tw:min-w-0 tw:flex-1 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:p-1.5"
        >
          <Avatar fallback="Maya Chen" shape="circle" size="xs" />
          <span
            class="tw:min-w-0 tw:flex-1 tw:truncate tw:text-left tw:text-sm tw:group-data-[state=collapsed]/sidebar:hidden"
          >
            Maya Chen
          </span>
        </button>
        <IconButton label="Inbox"><Icon icon={Inbox01} /></IconButton>
      </div>
    </SidebarFooter>
  </Sidebar>
{/snippet}

{#snippet sidebarDemo(defaultOpen: boolean)}
  <TooltipProvider>
    <div class="tw:h-screen">
      <SidebarProvider {defaultOpen}>
        <SidebarLayout class="tw:bg-sidebar">
          {@render appSidebar()}
          <SidebarInset class="tw:m-1.5 tw:ml-0 tw:rounded-2xl tw:shadow-edge">
            <header class="tw:flex tw:h-12 tw:items-center tw:gap-2 tw:px-4">
              <span class="tw:text-sm tw:font-medium">Home</span>
            </header>
            <div
              class="tw:text-muted-foreground tw:flex tw:flex-1 tw:items-center tw:justify-center tw:text-sm"
            >
              Page content
            </div>
          </SidebarInset>
        </SidebarLayout>
      </SidebarProvider>
    </div>
  </TooltipProvider>
{/snippet}

{#snippet orgRail()}
  <nav
    aria-label="Organizations"
    class="tw:bg-sidebar tw:flex tw:w-16 tw:shrink-0 tw:flex-col tw:items-center tw:gap-1.5 tw:pt-3 tw:pb-2"
  >
    {#each orgs as org (org.name)}
      <div class="tw:relative tw:flex tw:w-full tw:justify-center">
        {#if org.active}
          <span
            aria-hidden="true"
            class="tw:bg-foreground tw:absolute tw:top-1.5 tw:left-0 tw:h-6 tw:w-1 tw:rounded-r-full"
          ></span>
        {/if}
        <button
          type="button"
          aria-label={org.name}
          aria-current={org.active || undefined}
          class="tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:cursor-pointer tw:rounded-xl"
        >
          <Avatar fallback={org.name} muted size="base" class="tw:size-9" />
        </button>
      </div>
    {/each}
    <IconButton label="New organization" size="icon" class="tw:size-9">
      <Icon icon={Plus} />
    </IconButton>
  </nav>
{/snippet}

{#snippet projectFirstSidebar()}
  <Sidebar class="tw:pt-1.5">
    <SidebarHeader
      class="tw:h-12 tw:flex-row tw:items-center tw:gap-1 tw:px-2 tw:py-0"
    >
      <button
        type="button"
        class="tw:hover:bg-sidebar-accent tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:flex tw:min-w-0 tw:flex-1 tw:cursor-pointer tw:items-center tw:gap-1.5 tw:rounded-lg tw:py-1.5 tw:pr-1.5 tw:pl-2 tw:text-sm tw:font-medium"
      >
        <span class="tw:truncate">Acme</span>
        <Icon
          icon={ChevronSelectorVertical}
          class="tw:text-muted-foreground tw:size-3.5"
        />
      </button>
      <SidebarTrigger />
      <IconButton label="New chat"><Icon icon={MessageCircle01} /></IconButton>
    </SidebarHeader>
    <SidebarContent class="tw:gap-6 tw:px-2 tw:pt-3 tw:pb-2">
      <SidebarMenu class="tw:gap-1">
        {#each destinations as item (item.label)}
          <SidebarMenuItem>
            <SidebarMenuButton isActive={item.active} tooltip={item.label}>
              <Icon icon={item.icon} />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        {/each}
      </SidebarMenu>
      {#each folders as folder (folder.name)}
        <div class="tw:flex tw:flex-col tw:gap-1">
          <div class="tw:flex tw:h-6 tw:items-center tw:gap-1 tw:px-2">
            <span class="tw:text-muted-foreground tw:text-xs tw:font-medium">
              {folder.name}
            </span>
            <Icon
              icon={ChevronDown}
              class="tw:text-muted-foreground tw:size-3"
            />
          </div>
          <SidebarMenu class="tw:gap-1">
            {#each folder.projects as project (project.name)}
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={project.name}>
                  <ProjectIcon color={project.color} size="sm">
                    <Icon icon={project.icon} />
                  </ProjectIcon>
                  <span class="tw:flex-1">{project.name}</span>
                  {#if project.waiting !== undefined}
                    <span
                      aria-label="1 waiting on you"
                      class="tw:bg-warning tw:mr-1 tw:size-2 tw:rounded-full"
                    ></span>
                  {/if}
                </SidebarMenuButton>
              </SidebarMenuItem>
            {/each}
          </SidebarMenu>
        </div>
      {/each}
    </SidebarContent>
    <SidebarFooter class="tw:px-2 tw:pb-3">
      <div class="tw:flex tw:items-center tw:gap-1">
        <button
          type="button"
          class="tw:hover:bg-sidebar-accent tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:flex tw:min-w-0 tw:flex-1 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:p-1.5"
        >
          <Avatar fallback="Maya Chen" shape="circle" size="xs" />
          <span
            class="tw:min-w-0 tw:flex-1 tw:truncate tw:text-left tw:text-sm"
          >
            Maya Chen
          </span>
        </button>
        <IconButton label="Settings"><Icon icon={Settings02} /></IconButton>
        <IconButton label="Inbox"><Icon icon={Inbox01} /></IconButton>
      </div>
    </SidebarFooter>
  </Sidebar>
{/snippet}

{#if story === "project-first"}
  <TooltipProvider>
    <SidebarProvider defaultOpen>
      <div class="tw:bg-sidebar tw:flex tw:h-screen tw:w-full">
        {@render orgRail()}
        <SidebarLayout class="tw:bg-sidebar tw:flex-1">
          {@render projectFirstSidebar()}
          <SidebarInset class="tw:m-1.5 tw:ml-0 tw:rounded-2xl tw:shadow-edge">
            <header class="tw:flex tw:h-12 tw:items-center tw:px-4">
              <span class="tw:text-sm tw:font-medium">Today</span>
            </header>
          </SidebarInset>
        </SidebarLayout>
      </div>
    </SidebarProvider>
  </TooltipProvider>
{:else if story === "default"}
  {@render sidebarDemo(true)}
{:else if story === "collapsed"}
  {@render sidebarDemo(false)}
{:else if story === "loading"}
  <div class="tw:h-screen">
    <SidebarProvider defaultOpen>
      <SidebarLayout>
        <Sidebar>
          <SidebarHeader>
            <div class="tw:flex tw:items-center tw:gap-2 tw:p-2">
              <Avatar fallback="Acme Inc" size="xs" />
              <span class="tw:text-sm tw:font-medium">Acme Inc</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {#each { length: 6 }, index (index)}
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  {/each}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <div
            class="tw:flex tw:flex-1 tw:items-center tw:justify-center tw:text-sm tw:text-muted-foreground"
          >
            Page content
          </div>
        </SidebarInset>
      </SidebarLayout>
    </SidebarProvider>
  </div>
{/if}
