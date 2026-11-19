"use client";

import { useId, useState, type FormEvent } from "react";
import { Ban, CalendarClock, Check, CircleDot, Clock, Footprints, MapPin, Phone, UserX } from "lucide-react";
import {
  adminButton,
  adminInput,
  Badge,
  errorMessage,
  FormError,
  FormField,
  formatDateTime,
  Modal,
} from "@/components/admin/ui";
import type { ApiError } from "@/lib/api";
import type { BookingStatus, SessionView } from "./api";

/**
 * Pending -> Confirmed -> Completed, or Cancelled. An order nobody has taken yet shows as
 * "Needs physio" to staff and "Finding a physio" to the patient.
 */
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  AWAITING_ACCEPTANCE: "Pending",
  PENDING_ASSIGNMENT: "Needs physio",
  ACTIVE: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function BookingStatusBadge({ status, patient }: { status: BookingStatus; patient?: boolean }) {
  const label = BOOKING_STATUS_LABEL[status];
  switch (status) {
    case "AWAITING_ACCEPTANCE":
      return (
        <Badge tone="attention" icon={Clock}>
          {label}
        </Badge>
      );
    case "PENDING_ASSIGNMENT":
      return (
        <Badge tone="attention" icon={CircleDot}>
          {patient ? "Finding a physio" : label}
        </Badge>
      );
    case "ACTIVE":
      return (
        <Badge tone="good" icon={CalendarClock}>
          {label}
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge tone="good" icon={Check}>
          {label}
        </Badge>
      );
    default:
      return <Badge icon={Ban}>{label}</Badge>;
  }
}

const SESSION_LABEL: Record<SessionView["status"], { label: string; icon: typeof Clock; good?: boolean }> = {
  SCHEDULED: { label: "Scheduled", icon: CalendarClock },
  ON_THE_WAY: { label: "On the way", icon: Footprints, good: true },
  ARRIVED: { label: "Arrived", icon: MapPin, good: true },
  COMPLETED: { label: "Completed", icon: Check, good: true },
  CANCELLED: { label: "Cancelled", icon: Ban },
  NO_SHOW: { label: "No-show", icon: UserX },
};

export function SessionStatusBadge({ status }: { status: SessionView["status"] }) {
  const { label, icon, good } = SESSION_LABEL[status];
  return (
    <Badge tone={good ? "good" : "neutral"} icon={icon}>
      {label}
    </Badge>
  );
}

export function ContactLine({ session, who }: { session: SessionView; who: string }) {
  if (session.contact_phone) {
    return (
      <a href={`tel:${session.contact_phone}`} className={adminButton("secondary", "mt-2 max-w-full")}>
        <Phone className="size-4" aria-hidden="true" />
        Call {who}: <span className="tabular-nums">{session.contact_phone}</span>
      </a>
    );
  }
  if (session.status !== "SCHEDULED") return null;
  return (
    <p className="mt-2 text-xs text-stone-500">
      {who.charAt(0).toUpperCase() + who.slice(1)}&apos;s number appears at {formatDateTime(session.contact_opens_at)}.
    </p>
  );
}

// A confirmation dialog that requires a written reason, used for every cancel and rejection.
export function ReasonDialog({
  title,
  label,
  confirm,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  label: string;
  confirm: string;
  pending: boolean;
  error: ApiError | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState<string>();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setInvalid("Please write a short reason.");
      return;
    }
    setInvalid(undefined);
    onConfirm(reason.trim());
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id={id} label={label} error={invalid}>
          <textarea
            id={id}
            rows={3}
            maxLength={500}
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={Boolean(invalid)}
            className={`${adminInput} h-auto py-2`}
          />
        </FormField>
        <FormError message={error ? errorMessage(error) : null} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={adminButton("secondary")}>
            Keep it
          </button>
          <button type="submit" disabled={pending} className={adminButton("primary")}>
            {confirm}
          </button>
        </div>
      </form>
    </Modal>
  );
}
