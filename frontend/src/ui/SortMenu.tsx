import { t } from "@/i18n";
import { DropdownMenu } from "./DropdownMenu";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

type SortMenuProps = {
  options: readonly { value: string; label: string }[];
  sort: string;
  dir: "asc" | "desc";
  onSort: (value: string) => void;
  onDir: (dir: "asc" | "desc") => void;
};

export function SortMenu({ options, sort, dir, onSort, onDir }: SortMenuProps) {
  const current = options.find((option) => option.value === sort);
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu
        items={options.map((option) => ({ ...option, selected: option.value === sort }))}
        onSelect={onSort}
        trigger={
          <Button variant="secondary">
            <Icon name="sort" />
            {t("sort.by", { field: current?.label ?? sort })}
            <Icon name="chevronDown" />
          </Button>
        }
      />
      <IconButton
        label={dir === "asc" ? t("sort.ascending") : t("sort.descending")}
        onClick={() => onDir(dir === "asc" ? "desc" : "asc")}
      >
        <Icon name={dir === "asc" ? "arrowUp" : "arrowDown"} />
      </IconButton>
    </div>
  );
}
