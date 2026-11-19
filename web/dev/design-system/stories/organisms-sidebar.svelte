<script lang="ts" module>
  export const layouts = {
    "project-first": "fullscreen",
    default: "fullscreen",
    collapsed: "fullscreen",
    loading: "fullscreen",
  };
</script>

<script lang="ts">
  import Avatar from "../../../lib/studio/Avatar.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";
  import IconButton from "../../../lib/studio/IconButton.svelte";
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
  } from "../../../lib/studio/icons";
  import ProjectIcon from "../../../lib/studio/ProjectIcon.svelte";
  import Sidebar from "../../../lib/studio/Sidebar.svelte";
  import SidebarContent from "../../../lib/studio/SidebarContent.svelte";
  import SidebarFooter from "../../../lib/studio/SidebarFooter.svelte";
  import SidebarGroup from "../../../lib/studio/SidebarGroup.svelte";
  import SidebarGroupContent from "../../../lib/studio/SidebarGroupContent.svelte";
  import SidebarHeader from "../../../lib/studio/SidebarHeader.svelte";
  import SidebarInset from "../../../lib/studio/SidebarInset.svelte";
  import SidebarLayout from "../../../lib/studio/SidebarLayout.svelte";
  import SidebarMenu from "../../../lib/studio/SidebarMenu.svelte";
  import SidebarMenuButton from "../../../lib/studio/SidebarMenuButton.svelte";
  import SidebarMenuItem from "../../../lib/studio/SidebarMenuItem.svelte";
  import SidebarMenuSkeleton from "../../../lib/studio/SidebarMenuSkeleton.svelte";
  import SidebarProvider from "../../../lib/studio/SidebarProvider.svelte";
  import SidebarTrigger from "../../../lib/studio/SidebarTrigger.svelte";
  import TooltipProvider from "../../../lib/studio/TooltipProvider.svelte";

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
  <Sidebar class="pt-1.5">
    <SidebarHeader
      class="h-12 flex-row items-center gap-1 px-2 py-0 group-data-[state=collapsed]/sidebar:h-auto group-data-[state=collapsed]/sidebar:flex-col"
    >
      <button
        type="button"
        class="hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-1.5 pr-1.5 pl-2 group-data-[state=collapsed]/sidebar:flex-none group-data-[state=collapsed]/sidebar:p-0"
      >
        <Avatar fallback="Acme" size="xs" muted />
        <span
          class="min-w-0 flex-1 truncate text-left text-sm font-medium group-data-[state=collapsed]/sidebar:hidden"
        >
          Acme
        </span>
      </button>
      <SidebarTrigger class="group-data-[state=collapsed]/sidebar:mx-auto" />
      <IconButton
        label="New chat"
        class="group-data-[state=collapsed]/sidebar:hidden"
      >
        <Icon icon={MessageCircle01} />
      </IconButton>
    </SidebarHeader>
    <SidebarContent class="gap-6 px-2 pt-3 pb-2">
      <SidebarMenu class="gap-1">
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
        class="flex flex-col gap-2 group-data-[state=collapsed]/sidebar:hidden"
      >
        <p class="text-muted-foreground px-2 text-xs font-medium text-pretty">
          Projects
        </p>
        <SidebarMenu class="gap-1">
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
                <ul class="flex flex-col">
                  {#each tasks as task, index (task)}
                    <li class="relative">
                      <span
                        aria-hidden="true"
                        class="border-sidebar-border absolute top-0 left-4 h-1/2 w-3 rounded-bl-lg border-b border-l"
                      ></span>
                      {#if index < tasks.length - 1}
                        <span
                          aria-hidden="true"
                          class="border-sidebar-border absolute top-1/2 bottom-0 left-4 border-l"
                        ></span>
                      {/if}
                      <a
                        href="#task"
                        class="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground flex h-8 items-center rounded-lg pr-2 pl-9 text-sm transition-colors"
                      >
                        <span class="truncate">{task}</span>
                      </a>
                    </li>
                  {/each}
                </ul>
              {/if}
            </SidebarMenuItem>
          {/each}
          <SidebarMenuItem>
            <SidebarMenuButton class="text-muted-foreground">
              <Icon icon={Plus} />
              <span>Add project</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </SidebarContent>
    <SidebarFooter class="gap-0.5 px-2 pb-3">
      <div
        class="flex items-center gap-1 group-data-[state=collapsed]/sidebar:flex-col"
      >
        <button
          type="button"
          class="hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg p-1.5"
        >
          <Avatar fallback="Maya Chen" shape="circle" size="xs" />
          <span
            class="min-w-0 flex-1 truncate text-left text-sm group-data-[state=collapsed]/sidebar:hidden"
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
    <div class="h-screen">
      <SidebarProvider {defaultOpen}>
        <SidebarLayout class="bg-sidebar">
          {@render appSidebar()}
          <SidebarInset class="m-1.5 ml-0 rounded-2xl shadow-edge">
            <header class="flex h-12 items-center gap-2 px-4">
              <span class="text-sm font-medium">Home</span>
            </header>
            <div
              class="text-muted-foreground flex flex-1 items-center justify-center text-sm"
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
    class="bg-sidebar flex w-16 shrink-0 flex-col items-center gap-1.5 pt-3 pb-2"
  >
    {#each orgs as org (org.name)}
      <div class="relative flex w-full justify-center">
        {#if org.active}
          <span
            aria-hidden="true"
            class="bg-foreground absolute top-1.5 left-0 h-6 w-1 rounded-r-full"
          ></span>
        {/if}
        <button
          type="button"
          aria-label={org.name}
          aria-current={org.active || undefined}
          class="focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 cursor-pointer rounded-xl"
        >
          <Avatar fallback={org.name} muted size="base" class="size-9" />
        </button>
      </div>
    {/each}
    <IconButton label="New organization" size="icon" class="size-9">
      <Icon icon={Plus} />
    </IconButton>
  </nav>
{/snippet}

{#snippet projectFirstSidebar()}
  <Sidebar class="pt-1.5">
    <SidebarHeader class="h-12 flex-row items-center gap-1 px-2 py-0">
      <button
        type="button"
        class="hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-lg py-1.5 pr-1.5 pl-2 text-sm font-medium"
      >
        <span class="truncate">Acme</span>
        <Icon
          icon={ChevronSelectorVertical}
          class="text-muted-foreground size-3.5"
        />
      </button>
      <SidebarTrigger />
      <IconButton label="New chat"><Icon icon={MessageCircle01} /></IconButton>
    </SidebarHeader>
    <SidebarContent class="gap-6 px-2 pt-3 pb-2">
      <SidebarMenu class="gap-1">
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
        <div class="flex flex-col gap-1">
          <div class="flex h-6 items-center gap-1 px-2">
            <span class="text-muted-foreground text-xs font-medium">
              {folder.name}
            </span>
            <Icon icon={ChevronDown} class="text-muted-foreground size-3" />
          </div>
          <SidebarMenu class="gap-1">
            {#each folder.projects as project (project.name)}
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={project.name}>
                  <ProjectIcon color={project.color} size="sm">
                    <Icon icon={project.icon} />
                  </ProjectIcon>
                  <span class="flex-1">{project.name}</span>
                  {#if project.waiting !== undefined}
                    <span
                      aria-label="1 waiting on you"
                      class="bg-warning mr-1 size-2 rounded-full"
                    ></span>
                  {/if}
                </SidebarMenuButton>
              </SidebarMenuItem>
            {/each}
          </SidebarMenu>
        </div>
      {/each}
    </SidebarContent>
    <SidebarFooter class="px-2 pb-3">
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg p-1.5"
        >
          <Avatar fallback="Maya Chen" shape="circle" size="xs" />
          <span class="min-w-0 flex-1 truncate text-left text-sm">
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
      <div class="bg-sidebar flex h-screen w-full">
        {@render orgRail()}
        <SidebarLayout class="bg-sidebar flex-1">
          {@render projectFirstSidebar()}
          <SidebarInset class="m-1.5 ml-0 rounded-2xl shadow-edge">
            <header class="flex h-12 items-center px-4">
              <span class="text-sm font-medium">Today</span>
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
  <div class="h-screen">
    <SidebarProvider defaultOpen>
      <SidebarLayout>
        <Sidebar>
          <SidebarHeader>
            <div class="flex items-center gap-2 p-2">
              <Avatar fallback="Acme Inc" size="xs" />
              <span class="text-sm font-medium">Acme Inc</span>
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
            class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
          >
            Page content
          </div>
        </SidebarInset>
      </SidebarLayout>
    </SidebarProvider>
  </div>
{/if}
