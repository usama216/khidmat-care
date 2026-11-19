"use client";

import { AlertTriangle, BellRing, Check, CircleSlash, Send, X } from "lucide-react";
import { RecordLink, Section } from "@/components/admin/records";
import {
  adminButton,
  Badge,
  EmptyState,
  errorMessage,
  ErrorState,
  formatDateTime,
  FormError,
  TableSkeleton,
} from "@/components/admin/ui";
import { physioHref } from "./BookingsPage";
import { type AlertCheck, useBookingAlerts, useSendAlerts } from "./operationsApi";

function AlertBadge({ check }: { check: AlertCheck }) {
  if (check.alert_status === "SENT") {
    return (
      <Badge tone="good" icon={Check}>
        Sent
      </Badge>
    );
  }
  if (check.alert_status === "FAILED") {
    return (
      <Badge tone="attention" icon={X}>
        Failed
      </Badge>
    );
  }
  if (check.eligible) {
    return (
      <Badge tone="good" icon={BellRing}>
        Matches
      </Badge>
    );
  }
  return <Badge icon={CircleSlash}>Not matched</Badge>;
}

/**
 * Who got a WhatsApp alert for this order, who failed and why, and why every other approved
 * physio wasn't alerted. Lets staff fix a physio's settings and send again without logs.
 */
export function AlertsSection({ bookingId }: { bookingId: string }) {
  const report = useBookingAlerts(bookingId);
  const send = useSendAlerts();
  const data = report.data;
  const waiting = data?.checks.filter((check) => check.eligible && check.alert_status !== "SENT").length ?? 0;

  return (
    <Section
      title="WhatsApp alerts"
      description="Every approved physio: whether they were alerted for this order, and if not, why."
      flush
      actions={
        data?.order_open && data.whatsapp_configured ? (
          <button
            type="button"
            disabled={send.isPending}
            onClick={() => send.mutate(bookingId)}
            className={adminButton(waiting ? "primary" : "secondary", "h-8")}
          >
            <Send className="size-3.5" aria-hidden="true" />
            {send.isPending ? "Sending..." : waiting ? `Send to ${waiting} now` : "Send again"}
          </button>
        ) : null
      }
    >
      {report.isPending ? (
        <TableSkeleton rows={3} />
      ) : report.isError ? (
        <ErrorState onRetry={() => void report.refetch()} />
      ) : (
        <>
          {!report.data.whatsapp_configured ? (
            <p className="flex items-start gap-2 border-b border-stone-200 bg-red-50 px-5 py-3 text-sm text-red-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold">WhatsApp isn&apos;t set up on the server, so no alerts are sent.</strong>{" "}
                Add <code>WHATSAPP_PHONE_NUMBER_ID</code> and <code>WHATSAPP_ACCESS_TOKEN</code> to the API project on
                Vercel, then redeploy it.
              </span>
            </p>
          ) : null}
          {send.isError ? (
            <div className="px-5 pt-3">
              <FormError message={errorMessage(send.error)} />
            </div>
          ) : null}
          {send.isSuccess ? (
            <p role="status" className="px-5 pt-3 text-sm font-medium text-brand-800">
              {send.data.sent === 0
                ? "Nobody new to alert. Everyone who matches already got it, or nobody matches."
                : `Sent to ${send.data.sent} ${send.data.sent === 1 ? "physio" : "physios"}.`}
            </p>
          ) : null}
          {report.data.checks.length === 0 ? (
            <EmptyState title="No approved physios yet" />
          ) : (
            <ul className="divide-y divide-stone-100">
              {report.data.checks.map((check) => (
                <li key={check.provider_id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <RecordLink href={physioHref(check.provider_id)}>{check.name ?? "Unnamed"}</RecordLink>
                    <p className="text-xs text-stone-500 tabular-nums">{check.phone}</p>
                    {check.alert_status === "FAILED" && check.alert_error ? (
                      <p className="mt-1 text-red-800">WhatsApp said: {check.alert_error}</p>
                    ) : null}
                    {check.reasons.length > 0 ? (
                      <ul className="mt-1 list-inside list-disc text-stone-600">
                        {check.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="text-end">
                    <AlertBadge check={check} />
                    {check.alerted_at ? <p className="mt-1 text-xs text-stone-500">{formatDateTime(check.alerted_at)}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Section>
  );
}
