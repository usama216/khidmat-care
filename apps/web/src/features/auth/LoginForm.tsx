"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { adminButton, adminInput, errorMessage, FormError, FormField } from "@/components/admin/ui";
import { LogoMark } from "@/components/ui/Logo";
import { loginSchema, useCurrentUser, useLogin } from "./auth";

type FieldErrors = { email?: string; password?: string };

export function LoginForm() {
  const id = useId();
  const router = useRouter();
  const me = useCurrentUser();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (me.data?.role === "ADMIN") router.replace("/admin/");
  }, [me.data, router]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({ email: fields.email?.[0], password: fields.password?.[0] });
      return;
    }
    setErrors({});
    login.mutate(parsed.data, {
      onSuccess: (user) => {
        setPassword("");
        if (user.role === "ADMIN") router.replace("/admin/");
      },
    });
  };

  const notAdmin = login.data && login.data.role !== "ADMIN";

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
            <FormField id={`${id}-email`} label="Email" error={errors.email}>
              <input
                id={`${id}-email`}
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? `${id}-email-error` : undefined}
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
