"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, TriangleAlert } from "lucide-react";
import {
  adminButton,
  adminInput,
  Card,
  errorMessage,
  FormError,
  FormField,
  PageHeader,
} from "@/components/admin/ui";
import { changePasswordSchema, useChangePassword, useCurrentUser } from "./auth";

type FieldName = "current" | "next" | "confirm";

export function AccountPage() {
  const id = useId();
  const router = useRouter();
  const me = useCurrentUser();
  const change = useChangePassword();
  const [values, setValues] = useState<Record<FieldName, string>>({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [saved, setSaved] = useState(false);
  const mustChange = me.data?.must_change_password;

  const field = (name: FieldName, label: string, autoComplete: string, hint?: string) => (
    <FormField id={`${id}-${name}`} label={label} hint={hint} error={errors[name]}>
      <input
        id={`${id}-${name}`}
        type="password"
        autoComplete={autoComplete}
        value={values[name]}
        onChange={(event) => {
          setSaved(false);
          setValues((prev) => ({ ...prev, [name]: event.target.value }));
        }}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
        className={adminInput}
      />
    </FormField>
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({ current: fields.current?.[0], next: fields.next?.[0], confirm: fields.confirm?.[0] });
      return;
    }
    setErrors({});
    change.mutate(
      { current_password: parsed.data.current, new_password: parsed.data.next },
      {
        onSuccess: () => {
          setValues({ current: "", next: "", confirm: "" });
          setSaved(true);
          if (mustChange) router.replace("/admin/");
        },
      },
    );
  };

  return (
    <>
      <PageHeader title="Your account" description={me.data?.email ?? me.data?.phone ?? undefined} />
      {mustChange ? (
        <p className="mt-6 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          You&apos;re using a temporary password. Choose your own to continue.
        </p>
      ) : null}
      <Card className="mt-6 max-w-md p-5">
        <h2 className="font-semibold text-stone-900">Change password</h2>
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
          {field("current", "Current password", "current-password")}
          {field("next", "New password", "new-password", "At least 8 characters.")}
          {field("confirm", "Repeat new password", "new-password")}
          <FormError message={change.isError ? errorMessage(change.error) : null} />
          {saved ? (
            <p role="status" className="flex items-center gap-2 text-sm font-medium text-brand-800">
              <CircleCheck className="size-4" aria-hidden="true" />
              Password changed. Other devices were signed out.
            </p>
          ) : null}
          <button type="submit" disabled={change.isPending} className={adminButton("primary", "w-full")}>
            {change.isPending ? "Saving..." : "Change password"}
          </button>
        </form>
      </Card>
    </>
  );
}
