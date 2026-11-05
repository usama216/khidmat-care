"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { CircleCheck, CircleAlert, LoaderCircle, Lock, Send } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { ApiError } from "@/lib/api";
import { buttonClasses } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/form";
import { sendContactMessage } from "./api";

type FieldName = "name" | "phone" | "message";
type Fields = Record<FieldName, string>;
type FieldErrors = Partial<Record<FieldName, string>>;
type Status = "idle" | "submitting" | "success" | "error";

const initial: Fields = { name: "", phone: "", message: "" };
const PHONE_PATTERN = /^(03\d{9}|(\+|00)[1-9]\d{7,14})$/;

export function ContactForm({ t }: { t: Dictionary }) {
  const f = t.contact.form;
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const [fields, setFields] = useState<Fields>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [formError, setFormError] = useState("");

  const set = (key: FieldName, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (fields.name.trim().length < 2) next.name = f.invalidName;
    if (!PHONE_PATTERN.test(fields.phone.replace(/[\s()-]/g, ""))) next.phone = f.invalidPhone;
    if (fields.message.trim().length < 5) next.message = f.invalidMessage;
    return next;
  };

  const focusField = (name: string) => {
    formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();
  };

  // The server has the final say. Translate its field errors into the page language.
  const showServerFieldErrors = (error: ApiError) => {
    const messages: Record<FieldName, string> = {
      name: f.invalidName,
      phone: f.invalidPhone,
      message: f.invalidMessage,
    };
    const next: FieldErrors = {};
    for (const { field } of error.fieldErrors) {
      const name = field.replace("body.", "");
      if (name in messages) next[name as FieldName] = messages[name as FieldName];
    }
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) focusField(first);
    return Boolean(first);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (status === "submitting") return;

    const next = validate();
    setErrors(next);
    const firstInvalid = Object.keys(next)[0];
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    setStatus("submitting");
    setFormError("");
    try {
      await sendContactMessage({
        name: fields.name.trim(),
        phone: fields.phone.trim(),
        message: fields.message.trim(),
        locale: t.locale,
        website: honeypotRef.current?.value ?? "",
      });
      setFields(initial);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      if (error instanceof ApiError && showServerFieldErrors(error)) {
        setStatus("idle");
        return;
      }
      const code = error instanceof ApiError ? error.code : "";
      setFormError(code === "rate_limited" ? f.rateLimited : f.failed);
    }
  };

  if (status === "success") {
    return (
      <div role="status" className="flex flex-col items-center py-10 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <CircleCheck className="size-8" aria-hidden="true" />
        </span>
        <h3 className="mt-6 text-2xl font-semibold text-stone-900">{f.successTitle}</h3>
        <p className="mt-2 max-w-sm text-stone-600">{f.successDesc}</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className={buttonClasses("secondary", "md", "mt-7")}
        >
          {f.sendAnother}
        </button>
      </div>
    );
  }

  const submitting = status === "submitting";

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id={`${id}-name`} label={f.name} error={errors.name}>
          <input
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            maxLength={120}
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
            className={inputClass}
          />
        </Field>
        <Field id={`${id}-phone`} label={f.phone} error={errors.phone}>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            maxLength={32}
            value={fields.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder={f.phonePlaceholder}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? `${id}-phone-error` : undefined}
            className={`${inputClass} rtl:text-right`}
          />
        </Field>
      </div>

      <Field id={`${id}-message`} label={f.message} error={errors.message}>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={5}
          maxLength={2000}
          value={fields.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder={f.messagePlaceholder}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? `${id}-message-error` : undefined}
          className={`${inputClass} resize-y`}
        />
      </Field>

      {/* Honeypot: hidden from people, so only bots fill it in. */}
      <div aria-hidden="true" className="absolute -start-[9999px] size-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Website</label>
        <input ref={honeypotRef} id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {status === "error" && formError ? (
        <p role="alert" className="flex items-start gap-2.5 rounded-2xl bg-red-50 p-4 text-[0.95rem] font-medium text-red-800 ring-1 ring-red-100">
          <CircleAlert className="mt-1 size-4.5 shrink-0" aria-hidden="true" />
          {formError}
        </p>
      ) : null}

      <button type="submit" disabled={submitting} className={buttonClasses("primary", "lg", "mt-1 w-full")}>
        {submitting ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-5 rtl:-scale-x-100" aria-hidden="true" />
        )}
        {submitting ? f.submitting : f.submit}
      </button>
      <p className="flex items-start justify-center gap-2 text-center text-sm text-stone-500">
        <Lock className="mt-1 size-3.5 shrink-0" aria-hidden="true" />
        {f.privacy}
      </p>
    </form>
  );
}
