import { cloneElement, lazy, Suspense, useState, type ReactElement } from "react";
import type { DropdownMenuProps } from "./DropdownMenuImpl";

export type { MenuItem } from "./DropdownMenuImpl";

// Radix menus pull in Popper (positioning) and roving focus, ~25 KB gzip. Until
// the first click the trigger is a plain button; that click loads the menu and
// opens it (NFR-04).
const DropdownMenuImpl = lazy(() => import("./DropdownMenuImpl"));

type TriggerProps = { onClick?: () => void; onKeyDown?: (event: { key: string }) => void };

export function DropdownMenu(props: DropdownMenuProps & { trigger: ReactElement<TriggerProps> }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return cloneElement(props.trigger, {
      onClick: () => setArmed(true),
      onKeyDown: (event) => {
        if (event.key === "ArrowDown") setArmed(true);
      },
    });
  }
  return (
    <Suspense fallback={props.trigger}>
      <DropdownMenuImpl {...props} defaultOpen />
    </Suspense>
  );
}
