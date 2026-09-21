import { t } from "@/i18n";
import type { Priority } from "@/schemas";
import { Checkbox } from "@/ui/Checkbox";
import { Input, Select } from "@/ui/Input";

export type Row = {
  key: number;
  title: string;
  description: string;
  priority: Priority;
  dueInDays: number | null;
  selected: boolean;
};

export const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
export const TITLE_MAX = 120;
export const titleOk = (title: string) =>
  title.trim().length > 0 && title.trim().length <= TITLE_MAX;

type Props = { row: Row; onChange: (patch: Partial<Row>) => void };

/** One editable suggestion. Every string is rendered as plain text, never as markup (TH-403). */
export function SuggestionRow({ row, onChange }: Props) {
  const id = `ai-row-${row.key}`;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-line p-3">
      <Checkbox
        id={`${id}-pick`}
        label={row.title.trim() === "" ? t("ai.gen.title.field") : row.title}
        checked={row.selected}
        onCheckedChange={(selected) => onChange({ selected })}
      />
      <Input
        aria-label={t("ai.gen.title.field")}
        value={row.title}
        maxLength={TITLE_MAX}
        invalid={row.selected && !titleOk(row.title)}
        onChange={(event) => onChange({ title: event.target.value })}
      />
      {row.selected && !titleOk(row.title) && (
        <p role="alert" className="text-sm text-danger">
          {t("ai.gen.titleRequired")}
        </p>
      )}
      <Input
        aria-label={t("ai.gen.description.field")}
        value={row.description}
        maxLength={500}
        onChange={(event) => onChange({ description: event.target.value })}
      />
      <Select
        aria-label={t("ai.gen.priority.field")}
        value={row.priority}
        onChange={(event) => onChange({ priority: event.target.value as Priority })}
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {t(`priority.${p}`)}
          </option>
        ))}
      </Select>
    </li>
  );
}
