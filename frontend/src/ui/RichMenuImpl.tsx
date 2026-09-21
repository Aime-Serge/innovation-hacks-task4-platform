import type { ReactNode } from "react";
import Link from "next/link";
import { DropdownMenu as RadixMenu } from "radix-ui";
import { Icon, type IconName } from "./Icon";

export type RichEntry =
  | { kind: "header"; content: ReactNode }
  | { kind: "separator" }
  | { kind: "link"; href: string; label: string; icon: IconName }
  | { kind: "action"; value: string; label: string; icon: IconName }
  | {
      kind: "choice";
      label: string;
      icon: IconName;
      value: string;
      options: readonly { value: string; label: string }[];
      onChange: (value: string) => void;
    };

export type RichMenuProps = {
  trigger: ReactNode;
  entries: readonly RichEntry[];
  onAction?: (value: string) => void;
  /** Open immediately: used when the click that loaded this code should open the menu. */
  defaultOpen?: boolean;
};

const ITEM =
  "touch-target flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm outline-none data-[highlighted]:bg-subtle";
const PANEL = "z-50 min-w-56 rounded-md border border-line bg-surface p-1 shadow-md";

/** The header menus (create, account): links, actions, a choice submenu and a static header block. */
export default function RichMenuImpl({ trigger, entries, onAction, defaultOpen }: RichMenuProps) {
  return (
    <RadixMenu.Root modal={false} {...(defaultOpen === undefined ? {} : { defaultOpen })}>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content align="end" sideOffset={4} className={PANEL}>
          {entries.map((entry, index) => {
            switch (entry.kind) {
              case "header":
                return (
                  <RadixMenu.Label key={index} className="px-3 py-2">
                    {entry.content}
                  </RadixMenu.Label>
                );
              case "separator":
                return <RadixMenu.Separator key={index} className="my-1 h-px bg-line" />;
              case "link":
                return (
                  <RadixMenu.Item key={index} asChild className={ITEM}>
                    <Link href={entry.href}>
                      <Icon name={entry.icon} className="size-4 text-muted" />
                      {entry.label}
                    </Link>
                  </RadixMenu.Item>
                );
              case "action":
                return (
                  <RadixMenu.Item
                    key={index}
                    onSelect={() => onAction?.(entry.value)}
                    className={ITEM}
                  >
                    <Icon name={entry.icon} className="size-4 text-muted" />
                    {entry.label}
                  </RadixMenu.Item>
                );
              case "choice":
                return (
                  <RadixMenu.Sub key={index}>
                    <RadixMenu.SubTrigger className={`${ITEM} justify-between`}>
                      <span className="flex items-center gap-3">
                        <Icon name={entry.icon} className="size-4 text-muted" />
                        {entry.label}
                      </span>
                      <Icon name="chevronRight" className="size-4 text-muted" />
                    </RadixMenu.SubTrigger>
                    <RadixMenu.Portal>
                      <RadixMenu.SubContent sideOffset={4} className={PANEL}>
                        <RadixMenu.RadioGroup value={entry.value} onValueChange={entry.onChange}>
                          {entry.options.map((option) => (
                            <RadixMenu.RadioItem
                              key={option.value}
                              value={option.value}
                              className={`${ITEM} justify-between`}
                            >
                              {option.label}
                              <RadixMenu.ItemIndicator>
                                <Icon name="check" className="size-4 text-accent" />
                              </RadixMenu.ItemIndicator>
                            </RadixMenu.RadioItem>
                          ))}
                        </RadixMenu.RadioGroup>
                      </RadixMenu.SubContent>
                    </RadixMenu.Portal>
                  </RadixMenu.Sub>
                );
            }
          })}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
