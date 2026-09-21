import type { ReactNode } from "react";
import { DropdownMenu as RadixMenu } from "radix-ui";
import { Icon } from "./Icon";

export type MenuItem = { value: string; label: string; selected?: boolean };

export type DropdownMenuProps = {
  trigger: ReactNode;
  items: readonly MenuItem[];
  onSelect: (value: string) => void;
  /** Open immediately: used when the click that loaded this code should open the menu. */
  defaultOpen?: boolean;
};

/** Arrow-key navigation, typeahead and Escape come from Radix. */
export default function DropdownMenuImpl({
  trigger,
  items,
  onSelect,
  defaultOpen,
}: DropdownMenuProps) {
  // Non-modal: a modal menu marks the rest of the page aria-hidden while its
  // links stay focusable, which axe reports as aria-hidden-focus.
  return (
    <RadixMenu.Root modal={false} {...(defaultOpen === undefined ? {} : { defaultOpen })}>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-40 rounded-md border border-line bg-surface p-1 shadow-md"
        >
          {items.map((item) => (
            <RadixMenu.Item
              key={item.value}
              onSelect={() => onSelect(item.value)}
              className="touch-target flex cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm outline-none data-[highlighted]:bg-subtle"
            >
              {item.label}
              {item.selected === true && <Icon name="check" className="size-4 text-accent" />}
            </RadixMenu.Item>
          ))}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
