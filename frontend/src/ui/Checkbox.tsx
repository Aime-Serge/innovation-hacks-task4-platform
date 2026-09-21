import { Icon } from "./Icon";

type CheckboxProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/**
 * A native input stretched over the whole row, so the touch target is the row
 * (44px on touch layouts) while the visible box stays small. Keyboard, focus
 * and screen-reader behaviour come from the native element.
 */
export function Checkbox({ id, label, checked, onCheckedChange }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className="touch-target relative flex min-w-0 max-w-full cursor-pointer items-center gap-2"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="peer absolute inset-0 size-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-surface text-on-accent peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
      >
        {checked && <Icon name="check" className="size-3" />}
      </span>
      <span className="min-w-0 break-words text-sm text-fg">{label}</span>
    </label>
  );
}
