"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
import { adminButton, adminInput, errorMessage, FormError, FormField } from "@/components/admin/ui";
import { LogoMark } from "@/components/ui/Logo";
import { type CurrentUser, loginSchema, useCurrentUser, useLogin } from "@/features/auth/auth";
import { type ApiError, apiPost } from "@/lib/api";
import { cn } from "@/lib/cn";
import { homeFor } from "./PortalShell";

const PHONE = /^(03\d{9}|(\+|00)[1-9]\d{7,14})$/;

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z
    .string()
    .trim()
    .refine((value) => PHONE.test(value.replace(/[\s()-]/g, "")), "Enter a valid phone number, e.g. 0300 1234567."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

function destination(user: CurrentUser, next: string | null) {
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  return safe && user.role === "PATIENT" ? safe : homeFor(user);
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-stone-50 p-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2.5">
          <LogoMark className="size-9" />
          <span className="text-lg font-bold tracking-tight text-stone-900">Khidmat Care</span>
        </Link>
        <div className="mt-6 rounded-2xl bg-white p-7 shadow-sm ring-1 ring-stone-200">
          <h1 className="text-lg font-semibold text-stone-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
          {children}
        </div>
      </div>
    </main>
  );
}

export function PortalLogin() {
  const id = useId();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const me = useCurrentUser();
  const login = useLogin();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});

  useEffect(() => {
    if (me.data) router.replace(destination(me.data, next));
  }, [me.data, next, router]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({ identifier: fields.identifier?.[0], password: fields.password?.[0] });
      return;
    }
    setErrors({});
    login.mutate(parsed.data);
  };

  return (
    <Card title="Sign in" subtitle="Use the phone number you registered with.">
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <FormField id={`${id}-phone`} label="Phone number" error={errors.identifier}>
          <input
            id={`${id}-phone`}
            type="tel"
            autoComplete="username"
            autoFocus
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            aria-invalid={Boolean(errors.identifier)}
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
            className={adminInput}
          />
        </FormField>
        <FormError message={login.isError ? errorMessage(login.error) : null} />
        <button type="submit" disabled={login.isPending} className={adminButton("primary", "h-10 w-full")}>
          {login.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          Sign in
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-stone-600">
        New here?{" "}
        <Link
          href={next ? `/register/?next=${encodeURIComponent(next)}` : "/register/"}
          className="font-medium text-brand-800 underline"
        >
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-stone-500">Forgot your password? Message our support on WhatsApp.</p>
    </Card>
  );
}

export function PortalRegister() {
  const id = useId();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const client = useQueryClient();
  const me = useCurrentUser();
  const [role, setRole] = useState<"PATIENT" | "PROVIDER">(params.get("role") === "physio" ? "PROVIDER" : "PATIENT");
  const [values, setValues] = useState({ name: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({});

  const register = useMutation<CurrentUser, ApiError, typeof values & { role: string }>({
    mutationFn: (body) => apiPost<CurrentUser>("/auth/register", body),
    onSuccess: (user) => client.setQueryData(["auth", "me"], user),
  });

  useEffect(() => {
    if (me.data) router.replace(destination(me.data, next));
  }, [me.data, next, router]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({ name: fields.name?.[0], phone: fields.phone?.[0], password: fields.password?.[0] });
      return;
    }
    setErrors({});
    register.mutate({ ...parsed.data, role });
  };

  const field = (name: keyof typeof values, label: string, type: string, autoComplete: string, hint?: string) => (
    <FormField id={`${id}-${name}`} label={label} hint={hint} error={errors[name]}>
      <input
        id={`${id}-${name}`}
        type={type}
        autoComplete={autoComplete}
        value={values[name]}
        onChange={(event) => setValues((prev) => ({ ...prev, [name]: event.target.value }))}
        aria-invalid={Boolean(errors[name])}
        className={adminInput}
      />
    </FormField>
  );

  return (
    <Card title="Create your account">
      <div role="group" aria-label="Account type" className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1">
        {(
          [
            ["PATIENT", "I need a physio"],
            ["PROVIDER", "I am a physio"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={role === value}
            onClick={() => setRole(value)}
            className={cn(
              "h-8 rounded-md text-sm font-medium transition",
              role === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
        {field("name", "Full name", "text", "name")}
        {field("phone", "Phone number", "tel", "tel", "Stays hidden until 2 hours before a session.")}
        {field("password", "Password", "password", "new-password", "At least 8 characters.")}
        <FormError message={register.isError ? errorMessage(register.error) : null} />
        <button type="submit" disabled={register.isPending} className={adminButton("primary", "h-10 w-full")}>
          {register.isPending ? "Creating..." : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-stone-600">
        Already registered?{" "}
        <Link href="/login/" className="font-medium text-brand-800 underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
