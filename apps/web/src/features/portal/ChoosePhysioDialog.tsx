"use client";

import { useId, useState, type FormEvent } from "react";
import { adminButton, adminInput, errorMessage, FormError, FormField, Modal, Skeleton } from "@/components/admin/ui";
import { useAssignProvider } from "@/features/admin/operationsApi";
import { useChooseProvider, usePhysios, usePhysioSlots, type BookingView } from "./api";

const timeFormat = new Intl.DateTimeFormat("en-PK", { timeStyle: "short", timeZone: "Asia/Karachi" });

function todayInKarachi() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

// After a physiotherapist declines, the patient or staff pick someone else for the same order.
export function ChoosePhysioDialog({
  booking,
  staff = false,
  onClose,
}: {
  booking: BookingView;
  staff?: boolean;
  onClose: () => void;
}) {
  const id = useId();
  const physios = usePhysios({});
  const patientChoice = useChooseProvider();
  const staffChoice = useAssignProvider();
  const choose = staff ? staffChoice : patientChoice;
  const [physioId, setPhysioId] = useState("");
  const [day, setDay] = useState(todayInKarachi);
  const [slot, setSlot] = useState("");
  const [invalid, setInvalid] = useState<string>();
  const slots = usePhysioSlots(physioId || undefined, day);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!physioId || !slot) {
      setInvalid("Choose a physiotherapist and a time.");
      return;
    }
    setInvalid(undefined);
    choose.mutate({ id: booking.id, provider_id: physioId, start_at: slot }, { onSuccess: onClose });
  };

  return (
    <Modal title="Choose another physiotherapist" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id={`${id}-physio`} label="Physiotherapist">
          <select
            id={`${id}-physio`}
            value={physioId}
            onChange={(event) => {
              setPhysioId(event.target.value);
              setSlot("");
            }}
            className={adminInput}
          >
            <option value="">Choose</option>
            {physios.data?.map((physio) => (
              <option key={physio.id} value={physio.id}>
                {physio.name} ({physio.qualification}, {physio.experience_years} years)
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={`${id}-day`} label="Date">
          <input
            id={`${id}-day`}
            type="date"
            min={todayInKarachi()}
            value={day}
            onChange={(event) => {
              setDay(event.target.value);
              setSlot("");
            }}
            className={adminInput}
          />
        </FormField>
        {physioId ? (
          <FormField id={`${id}-slot`} label="Open times">
            {slots.isPending ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <select id={`${id}-slot`} value={slot} onChange={(event) => setSlot(event.target.value)} className={adminInput}>
                <option value="">{slots.data?.length ? "Choose a time" : "No open times on this day"}</option>
                {slots.data?.map((value) => (
                  <option key={value} value={value}>
                    {timeFormat.format(new Date(value))}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        ) : null}
        <FormError message={invalid ?? (choose.isError ? errorMessage(choose.error) : null)} />
        <button type="submit" disabled={choose.isPending} className={adminButton("primary", "w-full")}>
          Send order
        </button>
      </form>
    </Modal>
  );
}
