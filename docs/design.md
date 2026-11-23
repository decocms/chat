# Design rules

This document gives the layout rules of the browser app (`web/`). Read it before you add a view, a control or a list. The style rules (Tailwind classes, theme tokens, atoms, molecules and organisms) are in `AGENTS.md` (rule 11).

## The room screen

The room screen has five areas, from left to right.

| Area | Component | Contents |
|---|---|---|
| Rail | `AppNavigation` | Your rooms, search, new room. |
| Sidebar | `Sidebar` (room-sidebar) | The room's name (`SidebarHeader`), the views (main thread, Inbox, task board), the epics, the people. |
| Top bar | `RoomHeader` (room-shell) | The name of the view, the controls of the view, the pane tabs. |
| Main view | `RoomScene` overlay or chat | The chat of a thread, the Inbox (`RoomInbox`) or the full task board. |
| Pane | `DocumentToolbar` and the pane | The doc, the files, the apps, the board, beside the main view. |

The sidebar names the room. The top bar names the view. Do not show the room's name two times.

## The top bar

The top bar has one row on desktop. Its parts are in this order:

1. The name of the view (`RoomBarTitle`): "Sala principal", the epic's title, "Caixa de entrada", "Quadro de tarefas".
2. The controls of the view.
3. A vertical `Separator`.
4. The room's search field ("Buscar nesta sala"). Typing opens the Search pane beside the chat with the matches. Not in a DM.
5. The pane tabs (`DocumentToolbar`): Doc, files, apps, decisions, reminders, People & agents. They are 32px buttons in the top bar (`size="icon"`, Doc `size="default"`).

People & agents is a pane beside the chat, like Discord's member list (Online, Offline, Invited, with counts). It is not in the sidebar. Closing the Doc opens People & agents; closing People & agents closes the pane. The browser remembers which of the two you left open (and whether you closed the pane), so every room opens the same way. A DM always starts on its doc.

The separator divides two scopes. On its left, the controls change the view in the middle. On its right, the controls open parts of the room.

### Controls of the view

A control of the view acts on all of the view, not on one item in it. Examples: the scope of a list, an action on all items, the actions of the open epic.

1. If the main view needs controls of the view, put them in the top bar.
2. Put them after the name of the view and before the pane tabs.
3. Put a vertical `Separator` between them and the pane tabs.
4. Do not give the view a second header with its name. The top bar already names the view.
5. Use a maximum of three controls. If you need more, use a menu.
6. Use small controls: `Button` `size="sm"` (`h-7`, `text-xs`), or `IconButton`.
7. For a choice between two or three scopes, use a segmented group (`role="group"`, one `aria-pressed` button for each scope).

To add controls for a view:

1. Write one component for the controls, in the folder of the view. Example: `web/features/application/InboxControls.svelte`.
2. In `RoomScene`, give that component to `RoomHeader` as the `viewControls` snippet.
3. Give `viewControls` only while the view is open.
4. On phones, draw the same component at the top of the view, with `md:hidden`.

The top bar on phones has no space for the controls of a view. That is why the view draws them on phones. Use one component for the two places, so that they stay the same.

| View | Controls of the view | Component |
|---|---|---|
| Epic thread | The status pill ("A fazer" … "Arquivado"), with a menu of the statuses | `EpicActions` (`bar`), in `RoomBarTitle`. On phones: `EpicActions` (`sheet`), under the title in `ThreadHeader` |
| Inbox | "Esta sala" / "Todas as salas", "Resolver todos os pedidos (n)" | `InboxControls`, in the `viewControls` slot |
| Home Inbox (`/?inbox`, all rooms) | "Resolver todos os pedidos (n)" | `InboxControls`, in the bar of `HomeInbox` |
| Main thread, task board | None | |

### What does not go in the top bar

1. An action on one item stays on the item. Example: Reply, Open and Resolve on an Inbox row.
2. A filter for a part of the list stays at the top of the view. Example: the Inbox chips (Pedidos, Revisões, Menções).
3. An action on the selected items stays in a bar above the list. That bar shows only when you select an item.
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
2. While an action runs, show a `Spinner` in its button and disable the button.
3. When an item leaves a list, animate it out (`slide`, about 200 ms). Do not let it disappear in one frame.
4. If the person set `prefers-reduced-motion`, set the duration of each animation to 0.
5. For an action on many items, or an action that removes items, give "Desfazer" (Undo) for 5 seconds. Do not ask for a confirmation first.
6. To make Undo possible, send the action to the server after the 5 seconds (`INBOX_UNDO_MS`). If the view closes before that, send the action at once.
7. If the action fails, put the items back and show the error in the view.
