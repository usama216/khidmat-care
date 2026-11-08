"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { adminButton, adminInput, errorMessage, FormError, FormField } from "@/components/admin/ui";
import { LogoMark } from "@/components/ui/Logo";
import { isStaff, loginSchema, useCurrentUser, useLogin } from "./auth";

type FieldErrors = { identifier?: string; password?: string };

export function LoginForm() {
  const id = useId();
  const router = useRouter();
  const me = useCurrentUser();
  const login = useLogin();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (isStaff(me.data)) router.replace("/admin/");
  }, [me.data, router]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({ identifier: fields.identifier?.[0], password: fields.password?.[0] });
      return;
    }
    setErrors({});
    login.mutate(parsed.data, {
      onSuccess: (user) => {
        setPassword("");
        if (isStaff(user)) router.replace("/admin/");
      },
    });
  };

  const notAdmin = login.data && !isStaff(login.data);

  return (
    <main className="grid min-h-dvh place-items-center bg-stone-50 p-5">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5">
          <LogoMark className="size-9" />
          <span className="text-lg font-bold tracking-tight text-stone-900">Khidmat Care</span>
        </div>
        <div className="mt-6 rounded-2xl bg-white p-7 shadow-sm ring-1 ring-stone-200">
          <h1 className="text-lg font-semibold text-stone-900">Sign in to Admin</h1>
          <p className="mt-1 text-sm text-stone-500">For the Khidmat Care operations team.</p>
          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            <FormField id={`${id}-email`} label="Email or phone" error={errors.identifier}>
              <input
                id={`${id}-email`}
                autoComplete="username"
                autoFocus
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                aria-invalid={Boolean(errors.identifier)}
                aria-describedby={errors.identifier ? `${id}-email-error` : undefined}
                className={adminInput}
              />
            </FormField>
            <FormField id={`${id}-password`} label="Password" error={errors.password}>
              <input
                id={`${id}-password`}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? `${id}-password-error` : undefined}
                className={adminInput}
              />
            </FormField>
            <FormError
              message={
                notAdmin
                  ? "This account doesn't have admin access."
                  : login.isError
                    ? errorMessage(login.error)
                    : null
              }
            />
            <button type="submit" disabled={login.isPending} className={adminButton("primary", "h-10 w-full")}>
              {login.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              {login.isPending ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
