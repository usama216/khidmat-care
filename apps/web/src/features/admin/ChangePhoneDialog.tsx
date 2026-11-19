"use client";

import { useId, useState, type FormEvent } from "react";
import { PencilLine } from "lucide-react";
import { adminButton, adminInput, errorMessage, FormError, FormField, Modal } from "@/components/admin/ui";
import { useChangePhone } from "./operationsApi";

const PHONE = /^(03\d{9}|(\+|00)[1-9]\d{7,14})$/;

/**
 * The phone is the login, the WhatsApp alert number and the number shared before visits, so it's
 * changed only by staff after confirming who is asking. The change signs the account out
 * everywhere and is recorded with both numbers.
 */
export function ChangePhoneButton({
  kind,
  id,
  current,
}: {
  kind: "provider" | "patient";
  id: string;
  current: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={adminButton("ghost", "h-7 px-2 text-xs")}>
        <PencilLine className="size-3.5" aria-hidden="true" />
        Change phone
      </button>
      {open ? <ChangePhoneDialog kind={kind} id={id} current={current} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ChangePhoneDialog({
  kind,
  id,
  current,
  onClose,
}: {
  kind: "provider" | "patient";
  id: string;
  current: string;
  onClose: () => void;
}) {
  const fieldId = useId();
  const change = useChangePhone();
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; reason?: string }>({});

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!PHONE.test(phone.replace(/[\s()-]/g, ""))) next.phone = "Enter a valid phone number, e.g. 0300 1234567.";
    if (reason.trim().length < 3) next.reason = "Write how you confirmed it's really them.";
    setErrors(next);
    if (next.phone || next.reason) return;
    change.mutate({ kind, id, phone: phone.trim(), reason: reason.trim() }, { onSuccess: onClose });
  };

  return (
    <Modal title="Change phone number" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <p className="text-sm text-stone-600">
          Current number: <span className="font-medium text-stone-900 tabular-nums">{current}</span>
        </p>
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
          Only change it after confirming it&apos;s really them, for example by calling the old number or checking their
          CNIC. They&apos;ll be signed out everywhere and must sign in with the new number. WhatsApp alerts and the number
          shared before visits switch to the new one.
        </p>
        <FormField id={`${fieldId}-phone`} label="New phone number" error={errors.phone}>
          <input
            id={`${fieldId}-phone`}
            type="tel"
            autoFocus
            placeholder="0300 1234567"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-invalid={Boolean(errors.phone)}
            className={adminInput}
          />
        </FormField>
        <FormField
          id={`${fieldId}-reason`}
          label="How did you confirm it's them?"
          hint="Saved in the record's history, e.g. Called from the old number."
          error={errors.reason}
        >
          <input
            id={`${fieldId}-reason`}
            maxLength={300}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={Boolean(errors.reason)}
            className={adminInput}
          />
        </FormField>
        <FormError message={change.isError ? errorMessage(change.error) : null} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={adminButton("secondary")}>
            Cancel
          </button>
          <button type="submit" disabled={change.isPending} className={adminButton("primary")}>
            {change.isPending ? "Saving..." : "Change number"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
