"use client";

import { useId, useState, type FormEvent } from "react";
import { Building2, Home } from "lucide-react";
import { adminButton, adminInput, Card, errorMessage, FormError, FormField } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import { type ProviderProfile, useCatalog, useSavePractice } from "./api";

/**
 * Fee and where the physiotherapist sees patients. Kept apart from the verified profile so it
 * can change at any time, even after approval. Orders already placed keep their price.
 */
export function PracticeSettings({ profile }: { profile: ProviderProfile }) {
  const id = useId();
  const catalog = useCatalog();
  const save = useSavePractice();
  const [fee, setFee] = useState(profile.fee_pkr ? String(profile.fee_pkr) : "");
  const [home, setHome] = useState(profile.visit_home);
  const [clinic, setClinic] = useState(profile.visit_clinic);
  const [clinicAddress, setClinicAddress] = useState(profile.clinic_address ?? "");
  const [clinicArea, setClinicArea] = useState(profile.clinic_area_id ?? "");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saved, setSaved] = useState(false);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    const amount = Number(fee);
    const next: Record<string, string | undefined> = {};
    if (!Number.isInteger(amount) || amount < profile.fee_min_pkr || amount > profile.fee_max_pkr) {
      next.fee = `Enter a whole amount between ${formatPkr(profile.fee_min_pkr)} and ${formatPkr(profile.fee_max_pkr)}.`;
    }
    if (!home && !clinic) next.visits = "Choose home visits, clinic visits or both.";
    if (clinic && clinicAddress.trim().length < 5) next.clinicAddress = "Enter the clinic's full address.";
    if (clinic && !clinicArea) next.clinicArea = "Choose the clinic's area.";
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    save.mutate(
      {
        fee_pkr: amount,
        visit_home: home,
        visit_clinic: clinic,
        ...(clinic ? { clinic_address: clinicAddress.trim(), clinic_area_id: clinicArea } : {}),
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={onSubmit} onChange={() => setSaved(false)} noValidate className="space-y-4">
        <div>
          <h2 className="font-semibold text-stone-900">Fee and visits</h2>
          <p className="mt-0.5 text-sm text-stone-600">
            Patients see your fee before booking and pay you in cash after each session. A new fee applies to new orders
            only.
          </p>
        </div>
        {!profile.fee_pkr ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
            Set your fee so patients can book you.
          </p>
        ) : null}
        <FormField
          id={`${id}-fee`}
          label="Fee per session (Rs)"
          hint={`Between ${formatPkr(profile.fee_min_pkr)} and ${formatPkr(profile.fee_max_pkr)}.`}
          error={errors.fee}
        >
          <input
            id={`${id}-fee`}
            inputMode="numeric"
            value={fee}
            onChange={(event) => setFee(event.target.value.replace(/[^\d]/g, ""))}
            aria-invalid={Boolean(errors.fee)}
            className={cn(adminInput, "max-w-48")}
          />
        </FormField>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-stone-700">Where do you see patients?</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { checked: home, set: setHome, label: "At the patient's home", icon: Home },
              { checked: clinic, set: setClinic, label: "At my clinic", icon: Building2 },
            ].map(({ checked, set, label, icon: Icon }) => (
              <label
                key={label}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg p-3 text-sm ring-1 transition",
                  checked ? "bg-brand-50 ring-2 ring-brand-600" : "ring-stone-200 hover:bg-stone-50",
                )}
              >
                <input type="checkbox" checked={checked} onChange={(event) => set(event.target.checked)} className="size-4 accent-brand-700" />
                <Icon className="size-4 text-stone-500" aria-hidden="true" />
                <span className="font-medium text-stone-900">{label}</span>
              </label>
            ))}
          </div>
          {errors.visits ? <p className="mt-1 text-xs font-medium text-red-600">{errors.visits}</p> : null}
        </fieldset>
        {clinic ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              id={`${id}-caddress`}
              label="Clinic address"
              hint="Shown to patients once their visit is confirmed."
              error={errors.clinicAddress}
            >
              <input
                id={`${id}-caddress`}
                maxLength={500}
                value={clinicAddress}
                onChange={(event) => setClinicAddress(event.target.value)}
                aria-invalid={Boolean(errors.clinicAddress)}
                className={adminInput}
              />
            </FormField>
            <FormField id={`${id}-carea`} label="Clinic area" error={errors.clinicArea}>
              <select
                id={`${id}-carea`}
                value={clinicArea}
                onChange={(event) => setClinicArea(event.target.value)}
                aria-invalid={Boolean(errors.clinicArea)}
                className={adminInput}
              >
                <option value="">Choose</option>
                {catalog.data?.areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        ) : null}
        <FormError message={save.isError ? errorMessage(save.error) : null} />
        {saved ? <p role="status" className="text-sm font-medium text-brand-800">Saved.</p> : null}
        <button type="submit" disabled={save.isPending} className={adminButton("primary")}>
          {save.isPending ? "Saving..." : "Save fee and visits"}
        </button>
      </form>
    </Card>
  );
}
