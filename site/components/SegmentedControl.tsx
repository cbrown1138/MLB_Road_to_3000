"use client";

// A row of mutually exclusive buttons, e.g. "Per game | Per PA | Per AB".
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-md bg-emerald-900 text-sm ring-1 ring-zinc-700"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 transition-colors ${
            o.value === value
              ? "bg-emerald-500 font-medium text-sky-950"
              : "text-zinc-200 hover:bg-emerald-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
