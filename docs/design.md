# Design rules

This document gives the layout rules of the browser app (`web/`). Read it before you add a view, a control or a list. The style rules (Tailwind classes, theme tokens, atoms, molecules and organisms) are in `AGENTS.md` (rule 11).

## The room screen

The room screen has five areas, from left to right.

| Area | Component | Contents |
|---|---|---|
| Rail | `AppNavigation` | Your rooms, the Inbox (`/?inbox`, while something waits on you), search, new room. |
| Sidebar | `Sidebar` (room-sidebar) | The room's name (`SidebarHeader`), which is also the main thread, then the epics in three tabs (Mine, Open, Done; `EpicTree`) and the people. At the bottom: the user center (`UserCenter`). |
| Top bar | `RoomHeader` (room-shell) | ← in a thread, the name of the view, the controls of the view, the search, ⋮ with the call and the panes. |
| Main view | `RoomScene` | The chat of a thread. |
| Pane | `DocumentToolbar` and the pane | The doc, the files, the apps, beside the main view. |

The sidebar names the room. The top bar names the view. Do not show the room's name two times.

A right-click, a long press or Shift+F10 on a thread row in the sidebar opens the row's menu (`ThreadMenu`). It has "Copiar link da thread", then "Marcar como feita" (an open thread) or "Reabrir thread" (a done thread). The two status items send `epic.status`, as the status pill does. The room's notice confirms each item.

A room has no Inbox of its own. The Inbox is global: the home's page at `/?inbox` (`HomeInbox`, which draws `RoomInbox`). Desktop opens it from the rail. Do not add an Inbox entry to a room.

## The user center

The user center (`web/features/user-center/`, `UserCenter`) is the box at the bottom of the sidebar, in a room and on the home. It shows what is about the person, not about a room.

- Each item is one row in the box: an icon tile, a title, one line under it and, if necessary, one button on the right. The rows have the same height and the same background as "Your agent" (`AgentFoot`) and your account (`AccountRow`).
- The new version (`UpdateRow`) is the only row with the brand color.
- The order is: the new version, then the person's notices, then "Your agent", then the person.
- A notice row goes away when the person does its action.
- Do not put a notice about a room in the user center. For example, a request to join a room stays in the room.

### The user center on phones

1. The Chats list (`HomePanel`) shows the same box under the search field (`UserCenter phone`). It has only the notices: the new version, "Instalar no celular" (`InstallCard row`), the notifications (`NotifyOffer row`), then the invites and the message requests (`Requests center`).
2. The box is not there when it has no row.
3. Your face in the Chats bar shows the number of rows (`Count`).
4. A room has no notice over its chat. In a room, ← shows the number, because ← goes back to the Chats list.
5. On a touch screen, the × of a row is always visible.
6. Draw the phone's box only on a phone (`MOBILE_QUERY`, `$geometry.mobile`), not with `md:hidden`.

## The top bar

The top bar has one row on desktop. Its parts are in this order (Gimenes #6099, #6113, #6122):

1. In a thread, ← ("Voltar pra sala principal"). It opens the room's main thread.
2. The name of the view (`RoomBarTitle`): the epic's title. In a room's main thread, the room's search field is here in place of the name.
3. The controls of the view. A call with people in it shows its green phone here (`CallControls`).
4. A vertical `Separator`.
5. In other views, the room's search field. Typing opens the Search pane beside the chat with the matches. Its placeholder is "Buscar em {room}". In a DM it is "Buscar na conversa".
6. While a pane is open, a chip with its name (the Doc of an epic: with its tasks, "Doc 2/4") and × to close it.
7. ⋮ ("Mais opções"). The menu has "Iniciar chamada" ("Ligar para <name>" in a DM) while the room has no call, then Doc, Arquivos, Apps, Decisões, Lembretes and Pessoas, and the file open beside the chat. The open pane has ✓. A DM has no Doc and no Pessoas.

People & agents is a pane beside the chat, like Discord's member list (Online, Offline, Invited, with counts). It is not in the sidebar. A click on the open pane's item in ⋮ (the Doc too), or on the chip's ×, closes the pane. ⌥⌘B (Ctrl+Alt+B) opens and closes the pane. The browser remembers which of the two you left open (and whether you closed the pane), so every room opens the same way. A DM always starts on its doc.

The sidebar's top row is the room's name. It stays in place while the rest of the sidebar scrolls under it. The whole row opens the main thread: it has only the pointer, not a button's background. It has no ✎. To edit the room, right-click it in the rail: "Editar sala…" (`RoomMenu`) opens one dialog with the icon, the color (7 dots, a click applies) and the name. The menu has no Cor or Ícone submenus. It works for any room: a room that is not open opens first, then the dialog.

The separator divides two scopes. On its left, the controls change the view in the middle. On its right, the search and ⋮ open parts of the room.

### The room's search

The room's search field is `RoomSearchField` (chat). It finds messages of the room by words, by a person, or by both.

1. The person icon at the end of the field ("Filtrar por pessoa") lists the room's members. The picked person is a chip before the words.
2. A person with no words lists all of that person's own messages in the room, newest first. The messages of their agent are not included.
3. The Search pane lists the loaded matches and the server's pages of the room's history (`GET /api/books/:id/search`). "Mostrar mais" gets the next page.
4. The × and Esc clear the words and the person. Backspace in an empty field removes the person.
5. When the search is empty, the pane that was open before comes back. If no pane was open, the pane closes. An empty Search pane never stays open.
6. Phones: the search icon in the top bar opens the Search pane in the sheet. The field is at the top of the pane.

### The top bar on phones

The phone layout is B: one line, like WhatsApp (Gimenes #6016, #6030, #6032, #6052):

1. ← goes back to the home. It shows the number of user center rows (see "The user center on phones"). Then the room's icon (a DM: the person's face) and the title with ▾. The title opens the drawer with the threads.
2. Under the title, a subtitle:
   - A room's main thread: "3 online · 2 agentes" when other people are online, "2 agentes trabalhando" when only agents listen, else the first names of the members.
   - A thread: the room's name and the epic's progress.
   - A DM: "online" when the person is online.
3. At the end of the bar: the search icon (it opens the Search pane), then ⋮. The ⋮ menu has "Iniciar chamada" ("Ligar para <name>" in a DM) while the room has no call, then all the panes of the room: Doc, Arquivos, Apps, Decisões, Lembretes, Pessoas and Agents (`phoneMenuPanes`, Gimenes #6117). A DM has no Doc, no Pessoas and no Agents. An item opens that pane in the doc sheet. The item of the open pane has the accent background.
4. When a pane is open in the doc sheet, the bar shows the name of the pane, with the room's name under it. ← closes the sheet and goes back to the chat. There is no strip of pane tabs under the bar: use ⋮ to go to a different pane.

### The drawer on phones

The drawer has only the threads and the pinned items, like the desktop sidebar (Gimenes #6117):

1. At the top, the Mine, Open and Done tabs.
2. Under the tabs, only the threads, with no row for the room and no room name (Gimenes #6187). In a thread, ← goes back to the room's main chat.
3. Under the threads, Fixados (the pinned items). The Arquivos pane does not show them on a phone.
4. The drawer has no room name, no ✎, no avatar and no tab row. Rename the room from the desktop sidebar. Your account is on the home.

### All drawers on phones

All drawers on a phone are one component with one flow in the code (Gimenes #6174, #6175, #6221). Only `side` changes the look. The threads drawer of the room, New message, Salas da empresa, the room switcher and the actions of a message are all `Drawer` + `DrawerContent`:

1. One engine: `createDrawerMotion` in `web/lib/studio/drawer.ts`. One progress value (0 closed, 1 open) moves the panel's keyframe (`animate-drawer-<side>`) and the scrim's (`animate-drawer-scrim`). Open in 360 ms, close in 260 ms, with the `ease-drawer` curve. A slide lasts in proportion to the distance that is left. With reduced motion, there is no slide.
2. One gesture: a finger on the panel, the grab bar or the scrim drags the drawer towards its edge, on every side. Past a quarter of its size, it closes. Else it goes back. A drag in content that you scrolled scrolls the content. A finger can catch a drawer while it slides.
3. A tap on the grab bar or on the scrim closes the drawer. Escape closes it.
4. The owner decides. The drawer asks to close (`onOpenChange(false)`), and the owner closes it. The room sends this through its history, so Back closes the threads drawer.
5. One panel shape for each side (`drawerPanel`), and one grab bar (`DrawerHandle`). `fill` makes the drawer as tall as it can be (the threads).
6. The phone doc pane is not a drawer: it takes the place of the chat, under the top bar, with no scrim.
7. For a new drawer, use `Drawer` and `DrawerContent` with `side` (top, bottom, left or right). Do not use `Sheet` for a drawer on a phone.

### Controls of the view

A control of the view acts on all of the view, not on one item in it. Examples: the scope of a list, an action on all items, the actions of the open epic.

1. If the main view needs controls of the view, put them in the top bar.
2. Put them after the name of the view and before the search and ⋮.
3. Put a vertical `Separator` between them and the search.
4. Do not give the view a second header with its name. The top bar already names the view.
5. Use a maximum of three controls. If you need more, use a menu.
6. Use small controls: `Button` `size="sm"` (`h-7`, `text-xs`), or `IconButton`.
7. For a choice between two or three scopes, use a segmented group (`role="group"`, one `aria-pressed` button for each scope).

To add controls for a view:

1. Write one component for the controls, in the folder of the view. Example: `web/features/application/InboxControls.svelte` (in `HomeInbox`).
2. In `RoomScene`, give that component to `RoomHeader` as the `viewControls` snippet.
3. Give `viewControls` only while the view is open.
4. On phones, draw the same component at the top of the view, with `md:hidden`.

The top bar on phones has no space for the controls of a view. That is why the view draws them on phones. Use one component for the two places, so that they stay the same.

| View | Controls of the view | Component |
|---|---|---|
| Epic thread | The status pill ("A fazer" … "Arquivado"), with a menu of the statuses | `EpicActions`, in `RoomBarTitle`. Phones have no status control (Gimenes #4065). |
| Home Inbox (`/?inbox`, all rooms) | "Resolver todos os pedidos (n)" | `InboxControls`, in the bar of `HomeInbox` |
| Each thread of a room, while people are in the room's call | The green phone with how many are in it | `CallControls`, from `RoomScene`. With no call, "Iniciar chamada" is in ⋮. |

### The call

While a person is in the room's call, the call takes the view (`CallStage`, the `stage` of `RoomLayout`):

1. Desktop: the stage is at the left and the chat is a column at the right. The sidebar goes to its rail and the pane closes. When the person leaves the call, the sidebar and the pane come back as they were.
2. The stage shows the shared screen, or a grid of the people (camera or face). A click on a person puts that person on the stage, with the others in a row of small tiles.
3. The controls are under the stage, with their text: microphone, camera, screen, full screen, chat, leave. They are not in the top bar, because they are more than three.
4. A green ring marks who speaks. An icon marks a microphone that is off and a screen that is shared.
5. Full screen is the room's layout without the sidebar and the top bar, so that the chat can open beside the stage.
6. Phones: the stage is above the chat.
7. A person who is not in a call that is on gets one line above the chat: who is there, and "Entrar na call (n)".
8. The "Mais opções" menu of the controls has the microphone and the audio output of this device ("Microfone", "Saída de áudio"), as radio items. It shows the output list only if the browser can change the output (`setSinkId`). Safari and Firefox do not show it.

### What does not go in the top bar

1. An action on one item stays on the item. Example: Reply, Open and Resolve on an Inbox row.
2. A filter for a part of the list stays at the top of the view. Example: the Inbox chips (Pedidos, Revisões, Menções).
3. An action on the selected items stays in a bar above the list. That bar shows only when you select an item.
   - In the chat, the bar of the selected messages ("Encaminhar", `ForwardBar`) takes the composer's place. A bar above the chat covers or moves the messages, because the chat keeps its scroll at the bottom. Its "Copiar" ends selection mode and the room notice says "Copiado".
4. The close button of a view stays in the view.

## Lists

A list of items to act on (the Inbox) follows these rules.

1. Show each item in two lines: who and where on the first line, a preview on the second line.
2. Remove the Markdown marks from a preview (`inboxPreview`). Show the full text when the person opens the item.
3. Show the actions of a row when the pointer is on the row, or when the row has focus or is the current row.
4. On touch screens, show the actions all the time (`[@media(hover:none)]`).
5. A click on the row opens the item. The row actions do the other tasks.
6. Give the list keys: `j` and `k` move, `o` opens, `r` replies, `e` resolves, `x` selects. Show the keys in one line under the list.
7. Do not handle keys when the focus is in a text field.

## Feedback

1. While a list loads for the first time, show `Skeleton` rows with the shape of the real rows. Do not show only the word "Carregando…".
   - A loading view takes its shapes from the same place as the real view: `composer/shape.ts` for the composer, `room-shell/shape.ts` for messages and epic rows. A loading room opens its pane as the room will (`documentClosedBefore` in `room-layout/model.ts`). If you change a shape, change it there.
2. While an action runs, show a `Spinner` in its button and disable the button.
3. When an item leaves a list, animate it out (`slide`, about 200 ms). Do not let it disappear in one frame.
4. If the person set `prefers-reduced-motion`, set the duration of each animation to 0.
5. For an action on many items, or an action that removes items, give "Desfazer" (Undo) for 5 seconds. Do not ask for a confirmation first.
6. To make Undo possible, send the action to the server after the 5 seconds (`INBOX_UNDO_MS`). If the view closes before that, send the action at once.
7. If the action fails, put the items back and show the error in the view.
