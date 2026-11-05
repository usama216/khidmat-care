import type { ReactNode } from "react";

export const inputClass =
  "block w-full rounded-2xl border-0 bg-sand-50 px-4 py-3.5 text-base text-stone-900 ring-1 ring-stone-300/80 transition placeholder:text-stone-400 hover:ring-stone-400 focus:bg-white focus:ring-2 focus:ring-brand-600 focus:outline-none aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-500";

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[0.95rem] font-semibold text-stone-800">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
