/* The exact @dnd-kit surface the program editor is allowed to use.
 *
 * `DragDropManager` pulls in dnd-kit's default preset — the pointer and
 * keyboard sensors, the feedback, accessibility, auto-scroll and
 * selection-prevention plugins — so naming the sensors separately costs
 * nothing and documents what the editor actually configures. Widening this
 * list is a deliberate act: it grows a payload every lifter downloads. */
export {
  DragDropManager,
  Droppable,
  PointerSensor,
  KeyboardSensor,
  PointerActivationConstraints,
  Accessibility,
  Feedback,
} from "@dnd-kit/dom";
export { Sortable } from "@dnd-kit/dom/sortable";
export { CollisionPriority } from "@dnd-kit/abstract";
