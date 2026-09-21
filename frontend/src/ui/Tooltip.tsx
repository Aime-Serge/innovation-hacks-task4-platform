import type { ReactNode } from "react";
import { Tooltip as RadixTooltip } from "radix-ui";

type TooltipProps = { content: string; children: ReactNode };

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={4}
            className="z-50 max-w-72 break-words rounded-sm bg-fg px-2 py-1 text-xs text-canvas shadow-md"
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
