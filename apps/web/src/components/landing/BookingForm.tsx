"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ChevronDown, Lock } from "lucide-react";
import {
  serviceIds,
  type Dictionary,
  type GenderPreference,
  type ServiceId,
  type TimePreference,
} from "@/content/types";
import { lahoreAreas } from "@/config/site";
import { cn } from "@/lib/cn";
import { whatsappUrl } from "@/lib/whatsapp";
import { buttonClasses } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/form";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { SELECT_SERVICE_EVENT } from "./SelectServiceLink";

type Fields = {
  service: ServiceId | "";
  area: string;
  patientName: string;
  patientAge: string;
  gender: GenderPreference;
  time: TimePreference;
  notes: string;
};
type FieldErrors = Partial<Record<"service" | "area" | "patientName" | "patientAge", string>>;

const initial: Fields = {
  service: "",
  area: "",
  patientName: "",
  patientAge: "",
  gender: "any",
  time: "morning",
  notes: "",
};

export function BookingForm({ t }: { t: Dictionary }) {
  const f = t.book.form;
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<Fields>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  // "Book this" on a service card pre-selects that service here.
  useEffect(() => {
    const onSelect = (e: Event) => {
      const serviceId = (e as CustomEvent<ServiceId>).detail;
      setFields((prev) => ({ ...prev, service: serviceId }));
      setErrors((prev) => ({ ...prev, service: undefined }));
    };
    window.addEventListener(SELECT_SERVICE_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_SERVICE_EVENT, onSelect);
  }, []);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!fields.service) next.service = f.required;
    if (!fields.area.trim()) next.area = f.required;
    if (!fields.patientName.trim()) next.patientName = f.required;
    const age = Number(fields.patientAge);
    if (!fields.patientAge.trim()) next.patientAge = f.required;
    else if (!Number.isInteger(age) || age < 0 || age > 120) next.patientAge = f.invalidAge;
    return next;
  };

  const buildMessage = () => {
    const m = t.book.message;
    const lines = [
      m.greeting,
      "",
      `${m.service}: ${fields.service ? t.services.items[fields.service].title : ""}`,
      `${m.area}: ${fields.area.trim()}`,
      `${m.patient}: ${fields.patientName.trim()} (${fields.patientAge.trim()})`,
      `${m.gender}: ${f.genderOptions[fields.gender]}`,
      `${m.time}: ${f.timeOptions[fields.time]}`,
    ];
    if (fields.notes.trim()) lines.push(`${m.notes}: ${fields.notes.trim()}`);
    return lines.join("\n");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    const firstInvalid = Object.keys(next)[0];
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    window.open(whatsappUrl(buildMessage()), "_blank", "noopener,noreferrer");
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-5">
      <Field id={`${id}-service`} label={f.service} error={errors.service}>
        <div className="relative">
          <select
            id={`${id}-service`}
            name="service"
            value={fields.service}
            onChange={(e) => set("service", e.target.value as ServiceId)}
            aria-invalid={Boolean(errors.service)}
            aria-describedby={errors.service ? `${id}-service-error` : undefined}
            className={cn(inputClass, "appearance-none pe-11", !fields.service && "text-stone-400")}
          >
            <option value="" disabled>
              {f.servicePlaceholder}
            </option>
            {serviceIds.map((sid) => (
              <option key={sid} value={sid} className="text-stone-900">
                {t.services.items[sid].title}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute end-4 top-1/2 size-5 -translate-y-1/2 text-stone-500"
          />
        </div>
      </Field>

      <Field id={`${id}-area`} label={f.area} error={errors.area}>
        <input
          id={`${id}-area`}
          name="area"
          list={`${id}-areas`}
          autoComplete="address-level3"
          value={fields.area}
          onChange={(e) => set("area", e.target.value)}
          placeholder={f.areaPlaceholder}
          aria-invalid={Boolean(errors.area)}
          aria-describedby={errors.area ? `${id}-area-error` : undefined}
          className={inputClass}
        />
        <datalist id={`${id}-areas`}>
          {lahoreAreas.map((area) => (
            <option key={area} value={area} />
          ))}
        </datalist>
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_9rem]">
        <Field id={`${id}-name`} label={f.patientName} error={errors.patientName}>
          <input
            id={`${id}-name`}
            name="patientName"
            autoComplete="name"
            value={fields.patientName}
            onChange={(e) => set("patientName", e.target.value)}
            aria-invalid={Boolean(errors.patientName)}
            aria-describedby={errors.patientName ? `${id}-name-error` : undefined}
            className={inputClass}
          />
        </Field>
        <Field id={`${id}-age`} label={f.patientAge} error={errors.patientAge}>
          <input
            id={`${id}-age`}
            name="patientAge"
            inputMode="numeric"
            pattern="[0-9]*"
            value={fields.patientAge}
            onChange={(e) => set("patientAge", e.target.value.replace(/\D/g, "").slice(0, 3))}
            aria-invalid={Boolean(errors.patientAge)}
            aria-describedby={errors.patientAge ? `${id}-age-error` : undefined}
            className={inputClass}
          />
        </Field>
      </div>

      <Segmented
        name="gender"
        legend={f.gender}
        value={fields.gender}
        options={f.genderOptions}
        onChange={(v) => set("gender", v)}
      />
      <Segmented
        name="time"
        legend={f.time}
        value={fields.time}
        options={f.timeOptions}
        onChange={(v) => set("time", v)}
      />

      <Field id={`${id}-notes`} label={f.notes}>
        <textarea
          id={`${id}-notes`}
          name="notes"
          rows={3}
          value={fields.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder={f.notesPlaceholder}
          className={cn(inputClass, "resize-y")}
        />
      </Field>

      <button type="submit" className={buttonClasses("primary", "lg", "mt-2 w-full")}>
        <WhatsAppIcon className="size-[1.35rem]" />
        {f.submit}
      </button>
      <p className="flex items-start justify-center gap-2 text-center text-sm text-stone-500">
        <Lock className="mt-1 size-3.5 shrink-0" aria-hidden="true" />
        {f.privacy}
      </p>
    </form>
  );
}

function Segmented<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 block text-[0.95rem] font-semibold text-stone-800">{legend}</legend>
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-sand-100 p-1.5 ring-1 ring-sand-200">
        {(Object.keys(options) as T[]).map((key) => (
          <label key={key} className="relative">
            <input
              type="radio"
              name={name}
              value={key}
              checked={value === key}
              onChange={() => onChange(key)}
              className="peer sr-only"
            />
            <span className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl px-2 text-center text-[0.95rem] font-semibold text-stone-600 transition peer-checked:bg-white peer-checked:text-brand-800 peer-checked:shadow-sm peer-checked:ring-1 peer-checked:ring-stone-900/5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 hover:text-stone-900">
              {options[key]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
