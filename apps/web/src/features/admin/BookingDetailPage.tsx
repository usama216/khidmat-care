"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Ban,
  CalendarClock,
  CalendarPlus,
  Check,
  CircleDollarSign,
  ExternalLink,
  Flag,
  Footprints,
  Hand,
  MapPin,
  MessageSquareWarning,
  Phone,
  Send,
  ShoppingBag,
  Star,
  Undo2,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  BackLink,
  DetailGrid,
  DetailItem,
  Initials,
  RecordLink,
  RecordSkeleton,
  Section,
  StatCard,
  Timeline,
  type TimelineItem,
} from "@/components/admin/records";
import { adminButton, Badge, Card, EmptyState, ErrorState, formatDateTime } from "@/components/admin/ui";
import { ChoosePhysioDialog } from "@/features/portal/ChoosePhysioDialog";
import { BookingStatusBadge, ReasonDialog, SessionStatusBadge } from "@/features/portal/shared";
import { formatPkr } from "@/lib/format";
import { patientHref, physioHref } from "./BookingsPage";
import { ComplaintBadge } from "./ComplaintsPage";
import {
  type StaffBookingDetail,
  type StaffSessionDetail,
  useBookingDetail,
  useCloseSession,
} from "./operationsApi";

const RELATION: Record<string, string> = {
  SELF: "Themselves",
  PARENT: "Parent",
  SPOUSE: "Spouse",
  CHILD: "Child",
  SIBLING: "Sibling",
  OTHER: "Other",
};

const SESSION_STEP: Record<string, { label: string; icon: LucideIcon; tone?: "brand" | "attention" | "danger" }> = {
  SCHEDULED: { label: "scheduled", icon: CalendarPlus },
  ON_THE_WAY: { label: "physio on the way", icon: Footprints },
  ARRIVED: { label: "physio arrived", icon: MapPin, tone: "brand" },
  COMPLETED: { label: "completed", icon: Check, tone: "brand" },
  CANCELLED: { label: "cancelled", icon: Ban, tone: "danger" },
  NO_SHOW: { label: "marked no-show", icon: UserX, tone: "danger" },
};

export function BookingDetailPage() {
  const id = useSearchParams().get("id");
  const detail = useBookingDetail(id);

  if (!id) return <EmptyState title="No order chosen" description="Open an order from the Orders list." />;
  if (detail.isPending) return <RecordSkeleton />;
  if (detail.isError) {
    return (
      <>
        <BackLink href="/admin/bookings/" label="Orders" />
        <Card className="mt-4">
          {detail.error.status === 404 ? (
            <EmptyState title="This order wasn't found" />
          ) : (
            <ErrorState onRetry={() => void detail.refetch()} />
          )}
        </Card>
      </>
    );
  }
  return <BookingRecord data={detail.data} />;
}

function age(birthYear: number | null) {
  return birthYear ? `${new Date().getFullYear() - birthYear} years` : null;
}

function BookingRecord({ data }: { data: StaffBookingDetail }) {
  const booking = data.booking;
  const [assigning, setAssigning] = useState(false);
  const assignable = booking.status === "PENDING_ASSIGNMENT" || booking.status === "AWAITING_ACCEPTANCE";
  const done = data.sessions.filter((session) => session.status === "COMPLETED").length;
  const ratings = data.sessions.flatMap((session) => (session.rating ? [session.rating] : []));
  const average = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
  const openComplaints = data.complaints.filter((c) => c.status === "OPEN" || c.status === "IN_PROGRESS").length;

  return (
    <>
      <BackLink href="/admin/bookings/" label="Orders" />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[1.45rem] font-semibold tracking-tight text-stone-900">Order KC-{booking.number}</h1>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="mt-1 text-sm text-stone-500">
            {booking.service_name} · {booking.sessions_count} {booking.sessions_count === 1 ? "session" : "sessions"} ·
            placed {formatDateTime(booking.created_at)}
          </p>
        </div>
        {assignable ? (
          <button type="button" onClick={() => setAssigning(true)} className={adminButton("primary")}>
            <Send className="size-4" aria-hidden="true" />
            {booking.provider ? "Offer to another physio" : "Assign a physio"}
          </button>
        ) : null}
      </div>
      {assigning ? <ChoosePhysioDialog booking={booking} staff onClose={() => setAssigning(false)} /> : null}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Order value" value={formatPkr(booking.price_total_pkr)} hint="Cash paid to the physio" icon={ShoppingBag} />
        <StatCard
          label="Commission"
          value={formatPkr(data.commission_charged_pkr)}
          hint={`of ${formatPkr(data.commission_total_pkr)} at ${booking.commission_bps / 100}%`}
          icon={CircleDollarSign}
          tone="brand"
        />
        <StatCard
          label="Sessions done"
          value={`${done} / ${booking.sessions_count}`}
          hint={data.sessions.length < booking.sessions_count ? `${booking.sessions_count - data.sessions.length} not scheduled yet` : "All scheduled"}
          icon={CalendarClock}
        />
        <StatCard
          label={openComplaints ? "Open complaints" : "Rating"}
          value={openComplaints ? openComplaints : average ? `${average.toFixed(1)} / 5` : "-"}
          hint={openComplaints ? "Needs follow-up" : ratings.length ? `${ratings.length} rated` : "Not rated yet"}
          icon={openComplaints ? MessageSquareWarning : Star}
          tone={openComplaints ? "danger" : "neutral"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Visit">
            <DetailGrid>
              <DetailItem label="Patient">
                {booking.patient.name}
                <span className="block text-xs font-normal text-stone-500">
                  {[booking.patient.gender === "FEMALE" ? "Female" : "Male", age(booking.patient.birth_year), RELATION[booking.patient.relation]]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </DetailItem>
              <DetailItem label="Area">{booking.area_name}</DetailItem>
              <DetailItem label="Address" wide>
                {booking.address_line ?? "-"}
                {data.lat !== null && data.lng !== null ? (
                  <a
                    href={`https://www.google.com/maps?q=${data.lat},${data.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ms-2 inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:underline"
                  >
                    Map <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ) : null}
              </DetailItem>
              <DetailItem label="Condition" wide>
                <span dir="auto" className="block font-normal whitespace-pre-wrap text-stone-800">
                  {booking.condition}
                </span>
              </DetailItem>
              <DetailItem label="First visit requested">{formatDateTime(booking.preferred_start_at)}</DetailItem>
              <DetailItem label="Physio preference">
                {data.preferred_gender ? (data.preferred_gender === "FEMALE" ? "Female" : "Male") : "No preference"}
              </DetailItem>
              {booking.cancel_reason ? (
                <DetailItem label={`Cancelled ${data.cancelled_at ? formatDateTime(data.cancelled_at) : ""}`} wide>
                  <span className="font-normal text-red-800">{booking.cancel_reason}</span>
                </DetailItem>
              ) : null}
            </DetailGrid>
          </Section>

          <Section title="Sessions" description="Price and commission are fixed when the order is placed." flush>
            {data.sessions.length === 0 ? (
              <EmptyState title="No sessions yet" description="The first one is created when the physio accepts." />
            ) : (
              <ul className="divide-y divide-stone-100">
                {data.sessions.map((session) => (
                  <SessionItem key={session.id} session={session} assignedProvider={data.provider_id} />
                ))}
              </ul>
            )}
          </Section>

          {data.complaints.length > 0 ? (
            <Section title="Complaints" flush actions={<RecordLink href="/admin/complaints/">All complaints</RecordLink>}>
              <ul className="divide-y divide-stone-100">
                {data.complaints.map((complaint) => (
                  <li key={complaint.id} className="px-5 py-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <ComplaintBadge status={complaint.status} />
                      <span className="text-xs text-stone-500">{formatDateTime(complaint.created_at)}</span>
                    </div>
                    <p dir="auto" className="mt-2 whitespace-pre-wrap text-stone-800">
                      {complaint.text}
                    </p>
                    {complaint.resolution ? (
                      <p className="mt-1 text-stone-500">Decision: {complaint.resolution}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="History" description="Every step of this order, oldest first.">
            <Timeline items={timelineItems(data)} format={formatDateTime} />
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Booked by">
            <Person
              name={booking.booker_name}
              phone={booking.booker_phone}
              href={patientHref(data.booked_by_id)}
              linkLabel="Open account"
            />
          </Section>
          <Section title="Physiotherapist">
            {booking.provider ? (
              <Person
                name={booking.provider.name}
                phone={booking.provider_phone}
                href={physioHref(booking.provider.id)}
                linkLabel="Open record"
                detail={`${booking.provider.qualification}, ${booking.provider.experience_years} years · ${booking.provider.rating_avg.toFixed(1)} rating`}
              />
            ) : (
              <p className="text-sm text-stone-500">No physiotherapist yet.</p>
            )}
          </Section>
          <Section title="Offers" description="Who this order was offered to." flush>
            {data.assignments.length === 0 ? (
              <p className="px-5 py-4 text-sm text-stone-500">Not offered yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {data.assignments.map((assignment) => (
                  <li key={`${assignment.provider_id}-${assignment.offered_at}`} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <RecordLink href={physioHref(assignment.provider_id)} className="text-stone-900">
                        {assignment.provider_name ?? "Unnamed"}
                      </RecordLink>
                      <AssignmentBadge status={assignment.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {formatDateTime(assignment.offered_at)}
                      {assignment.assigned_by_name ? ` · by ${assignment.assigned_by_name}` : ""}
                    </p>
                    {assignment.reject_reason ? (
                      <p className="mt-1 text-stone-600">&ldquo;{assignment.reject_reason}&rdquo;</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function Person({
  name,
  phone,
  href,
  linkLabel,
  detail,
}: {
  name: string | null;
  phone: string | null;
  href: string;
  linkLabel: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Initials name={name} />
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-stone-900">{name ?? "Unnamed"}</p>
        {detail ? <p className="text-xs text-stone-500">{detail}</p> : null}
        {phone ? (
          <a href={`tel:${phone}`} className="mt-1 inline-flex items-center gap-1.5 text-stone-700 tabular-nums hover:underline">
            <Phone className="size-3.5" aria-hidden="true" />
            {phone}
          </a>
        ) : null}
        <p className="mt-2">
          <RecordLink href={href}>{linkLabel}</RecordLink>
        </p>
      </div>
    </div>
  );
}

function AssignmentBadge({ status }: { status: StaffBookingDetail["assignments"][number]["status"] }) {
  switch (status) {
    case "ACCEPTED":
      return (
        <Badge tone="good" icon={Check}>
          Accepted
        </Badge>
      );
    case "OFFERED":
      return (
        <Badge tone="attention" icon={CalendarClock}>
          Waiting
        </Badge>
      );
    case "REJECTED":
      return <Badge icon={X}>Declined</Badge>;
    default:
      return <Badge icon={Undo2}>Withdrawn</Badge>;
  }
}

function SessionItem({ session, assignedProvider }: { session: StaffSessionDetail; assignedProvider: string | null }) {
  const close = useCloseSession();
  const [dialog, setDialog] = useState<"CANCELLED" | "NO_SHOW" | null>(null);
  const open = ["SCHEDULED", "ON_THE_WAY", "ARRIVED"].includes(session.status);

  return (
    <li className="px-5 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-stone-900">
          Session {session.sequence}
          <span className="font-normal text-stone-500"> · {formatDateTime(session.scheduled_at)}</span>
        </p>
        <SessionStatusBadge status={session.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <Fact label="Price" value={formatPkr(session.price_pkr)} />
        <Fact
          label="Commission"
          value={`${formatPkr(session.commission_pkr)}${session.commission_charged ? " charged" : ""}`}
        />
        <Fact label="Arrived" value={session.arrived_at ? formatDateTime(session.arrived_at) : "-"} />
        <Fact label="Completed" value={session.completed_at ? formatDateTime(session.completed_at) : "-"} />
      </dl>
      {session.provider_id !== assignedProvider ? (
        <p className="mt-2 text-xs text-stone-500">
          Done by{" "}
          <RecordLink href={physioHref(session.provider_id)}>{session.provider_name ?? "another physio"}</RecordLink>
        </p>
      ) : null}
      {session.pain_score !== null || session.notes ? (
        <div className="mt-3 rounded-lg bg-stone-50 p-3 ring-1 ring-stone-200">
          {session.pain_score !== null ? (
            <p className="text-stone-700">
              Pain score <strong className="font-semibold">{session.pain_score} of 10</strong>
            </p>
          ) : null}
          {session.notes ? (
            <p dir="auto" className="mt-1 whitespace-pre-wrap text-stone-600">
              {session.notes}
            </p>
          ) : null}
        </div>
      ) : null}
      {session.rating ? (
        <p className="mt-2 flex items-start gap-1.5 text-stone-700">
          <Star className="mt-0.5 size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-hidden="true" />
          <span>
            Rated {session.rating} of 5{session.review_comment ? `: “${session.review_comment}”` : ""}
          </span>
        </p>
      ) : null}
      {session.cancel_reason ? <p className="mt-2 text-red-800">Reason: {session.cancel_reason}</p> : null}
      {open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setDialog("CANCELLED")} className={adminButton("secondary")}>
            Cancel session
          </button>
          <button type="button" onClick={() => setDialog("NO_SHOW")} className={adminButton("ghost")}>
            Mark no-show
          </button>
        </div>
      ) : null}
      {dialog ? (
        <ReasonDialog
          title={dialog === "NO_SHOW" ? "Mark as no-show?" : "Cancel this session?"}
          label="Reason (saved in the audit log)"
          confirm="Confirm"
          pending={close.isPending}
          error={close.error}
          onClose={() => setDialog(null)}
          onConfirm={(reason) => close.mutate({ id: session.id, status: dialog, reason }, { onSuccess: () => setDialog(null) })}
        />
      ) : null}
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-900 tabular-nums">{value}</dd>
    </div>
  );
}

function timelineItems(data: StaffBookingDetail): TimelineItem[] {
  return data.timeline.map((entry, index) => {
    const key = `${entry.type}-${entry.at}-${index}`;
    const by = entry.actor_name ? ` by ${entry.actor_name}` : "";
    switch (entry.type) {
      case "ORDER_PLACED":
        return { key, at: entry.at, icon: ShoppingBag, title: `Order placed${by}` };
      case "OFFERED":
        return { key, at: entry.at, icon: Send, title: `Offered to ${entry.note ?? "a physio"}${by}` };
      case "ACCEPTED":
        return { key, at: entry.at, icon: Hand, tone: "brand", title: `Accepted${by}` };
      case "REJECTED":
        return { key, at: entry.at, icon: X, tone: "attention", title: `Declined${by}`, detail: entry.note };
      case "WITHDRAWN":
        return { key, at: entry.at, icon: Undo2, title: "Offer withdrawn" };
      case "SESSION": {
        const step = SESSION_STEP[entry.status ?? ""] ?? { label: entry.status ?? "", icon: CalendarClock };
        return {
          key,
          at: entry.at,
          icon: step.icon,
          tone: step.tone,
          title: `Session ${entry.session_sequence ?? ""} ${step.label}${by}`,
        };
      }
      case "RATED":
        return {
          key,
          at: entry.at,
          icon: Star,
          title: `Session ${entry.session_sequence ?? ""} rated ${entry.status} of 5`,
          detail: entry.note,
        };
      case "COMPLAINT_RAISED":
        return { key, at: entry.at, icon: Flag, tone: "danger", title: "Complaint raised" };
      case "COMPLAINT_CLOSED":
        return {
          key,
          at: entry.at,
          icon: Check,
          title: `Complaint ${entry.status === "DISMISSED" ? "dismissed" : "resolved"}`,
          detail: entry.note,
        };
      default:
        return { key, at: entry.at, icon: Ban, tone: "danger", title: "Order cancelled", detail: entry.note };
    }
  });
}

