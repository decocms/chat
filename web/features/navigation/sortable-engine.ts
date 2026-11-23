import {
  Accessibility,
  DragDropManager,
  PointerActivationConstraints,
  PointerSensor,
  defaultPreset,
} from "@dnd-kit/dom";
import { Sortable, isSortable } from "@dnd-kit/dom/sortable";

import {
  ROOT_GROUP,
  type SortableMove,
  type SortableRowOptions,
} from "./sortable";

/**
 * Pointer and touch sorting for the epic list and the rail's rooms (@dnd-kit/dom). This module is
 * only loaded after the sidebar has rendered (see ./sortable). Keyboard sorting
 * stays with the list's own Alt+Arrow shortcut so Enter and Space keep
 * activating the row, and rows only sort among siblings of the same parent.
 * Where the drag engine cannot start (no DOM APIs), rows simply do not sort.
 */
export function createSortableEngine(onmove: (move: SortableMove) => void) {
  let manager: DragDropManager | null | undefined;
  const engine = () => {
    if (manager !== undefined) return manager;
    try {
      const created = new DragDropManager({
        sensors: [
          PointerSensor.configure({
            // The row is a button: a press-and-move on it must still sort.
            preventActivation: () => false,
            activationConstraints: (event) =>
              event.pointerType === "mouse"
                ? [new PointerActivationConstraints.Distance({ value: 6 })]
                : [
                    new PointerActivationConstraints.Delay({
                      value: 250,
                      tolerance: 8,
                    }),
                  ],
          }),
        ],
        plugins: defaultPreset.plugins.filter(
          (plugin) => plugin !== Accessibility,
        ),
      });
      created.monitor.addEventListener("dragend", (event) => {
        const source = event.operation.source;
        if (event.canceled || !source || !isSortable(source)) return;
        if (source.index === source.initialIndex) return;
        onmove({
          id: String(source.id),
          group: String(source.group ?? ROOT_GROUP),
          fromIndex: source.initialIndex,
          toIndex: source.index,
        });
      });
      manager = created;
    } catch {
      manager = null;
    }
    return manager;
  };
  const type = (group: string) => `epic:${group}`;
  return {
    row(node: HTMLElement, options: SortableRowOptions) {
      const owner = engine();
      if (!owner) return {};
      const sortable = new Sortable(
        {
          id: options.id,
          index: options.index,
          element: node,
          group: options.group,
          type: type(options.group),
          accept: [type(options.group)],
          disabled: options.disabled,
          transition: { duration: 200, easing: "ease" },
        },
        owner,
      );
      return {
        update(next: SortableRowOptions) {
          sortable.id = next.id;
          sortable.group = next.group;
          sortable.type = type(next.group);
          sortable.accept = [type(next.group)];
          sortable.index = next.index;
          sortable.disabled = next.disabled;
        },
        destroy() {
          sortable.destroy();
        },
      };
    },
    destroy() {
      manager?.destroy();
      manager = undefined;
    },
  };
}
