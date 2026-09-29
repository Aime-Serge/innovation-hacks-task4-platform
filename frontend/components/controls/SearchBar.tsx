"use client";

export function SearchBar({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const id = `search-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div role="search" className="relative w-full sm:w-72">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className="w-full rounded border border-border-hairline bg-surface py-1.5 pl-3 pr-7 text-sm text-text-primary placeholder:text-text-secondary focus-visible:border-interactive"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
        >
          ×
        </button>
      )}
    </div>
  );
}
