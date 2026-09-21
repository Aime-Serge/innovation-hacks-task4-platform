import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { Skeleton } from "./Skeleton";

export type FilterGroup = {
  id: string;
  legend: string;
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  /** Options are still loading: hold the space so the list below does not jump. */
  pending?: boolean;
  /** A long option list scrolls inside a fixed-height box instead of growing the page. */
  scroll?: boolean;
};

type FilterBarProps = { groups: readonly FilterGroup[]; active: boolean; onClear: () => void };

/** FR-16: multi-value groups (OR inside a group, AND across groups) plus clear-all. */
export function FilterBar({ groups, active, onClear }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
      {groups.map((group) => (
        <fieldset key={group.id} className="min-w-0 max-w-full">
          <legend className="mb-1 text-sm font-medium">{group.legend}</legend>
          <div
            className={cn(
              "flex min-w-0 flex-wrap gap-x-4",
              group.scroll === true && "max-h-28 overflow-y-auto",
            )}
          >
            {group.pending === true && <Skeleton className="h-28 w-48" />}
            {group.options.map((option) => (
              <Checkbox
                key={option.value}
                id={`${group.id}-${option.value}`}
                label={option.label}
                checked={group.selected.includes(option.value)}
                onCheckedChange={(checked) =>
                  group.onChange(
                    checked
                      ? [...group.selected, option.value]
                      : group.selected.filter((value) => value !== option.value),
                  )
                }
              />
            ))}
          </div>
        </fieldset>
      ))}
      {active && (
        <Button variant="ghost" onClick={onClear} className="self-end">
          {t("common.clearFilters")}
        </Button>
      )}
    </div>
  );
}
