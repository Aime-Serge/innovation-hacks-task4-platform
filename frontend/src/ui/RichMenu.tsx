import { cloneElement, lazy, Suspense, useState, type ReactElement } from "react";
import type { RichMenuProps } from "./RichMenuImpl";

export type { RichEntry } from "./RichMenuImpl";

// Same idea as DropdownMenu: the Radix code loads on the first click (NFR-04).
const RichMenuImpl = lazy(() => import("./RichMenuImpl"));

type TriggerProps = { onClick?: () => void; onKeyDown?: (event: { key: string }) => void };

export function RichMenu(props: RichMenuProps & { trigger: ReactElement<TriggerProps> }) {
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
      <RichMenuImpl {...props} defaultOpen />
    </Suspense>
  );
}
