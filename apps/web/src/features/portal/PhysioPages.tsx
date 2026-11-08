"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, CircleAlert, Clock, FileCheck2, Plus, Trash2, Upload, X } from "lucide-react";
import { z } from "zod";
import {
  adminButton,
  adminInput,
  Badge,
  Card,
  EmptyState,
  errorMessage,
  ErrorState,
  formatDateTime,
  FormError,
  FormField,
  Modal,
  PageHeader,
  Skeleton,
  TableSkeleton,
} from "@/components/admin/ui";
import type { ApiError } from "@/lib/api";
import { formatPkr } from "@/lib/format";
import { cn } from "@/lib/cn";
import { DOCUMENT_ACCEPT, IMAGE_ACCEPT, storageUrl, uploadFile, type FilePurpose } from "@/lib/upload";
import {
  useAdvanceSession,
  useAttachDocument,
  useCancelJobSession,
  useCatalog,
  useJobs,
  useMyTopups,
  useProviderProfile,
  useRequestTopup,
  useRespondToOffer,
  useSaveAvailability,
  useSaveProfile,
  useScheduleSession,
  useSubmitApplication,
  useWallet,
  useWalletHistory,
  type AvailabilitySlot,
  type BookingView,
  type DocumentType,
  type Gender,
  type ProviderProfile,
  type SessionView,
} from "./api";
import { minuteLabel } from "./FindPage";
import { PortalPage, RequireRole } from "./PortalShell";
import { BookingStatusBadge, ContactLine, ReasonDialog, SessionStatusBadge } from "./shared";

function PhysioPage({ children }: { children: ReactNode }) {
  return (
    <PortalPage>
      <RequireRole role="PROVIDER">{() => children}</RequireRole>
    </PortalPage>
  );
}

function FileButton({
  label,
  accept,
  purpose,
  done,
  onUploaded,
}: {
  label: string;
  accept: string;
  purpose: FilePurpose;
  done?: boolean;
  onUploaded: (fileId: string) => Promise<unknown> | void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await onUploaded(await uploadFile(file, purpose));
    } catch (failure) {
      setError(errorMessage(failure, "The upload failed. Please try again."));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 rounded-lg p-3 ring-1 ring-stone-200">
        <span className="flex items-center gap-2 text-sm font-medium text-stone-800">
          {done ? <FileCheck2 className="size-4 text-brand-700" aria-hidden="true" /> : null}
          {label}
          {done ? <span className="text-xs font-normal text-stone-500">Uploaded</span> : null}
        </span>
        <label className={cn(adminButton("secondary"), busy ? "opacity-50" : "cursor-pointer")}>
          <Upload className="size-4" aria-hidden="true" />
          {busy ? "Uploading..." : done ? "Replace" : "Upload"}
          <input
            ref={input}
            type="file"
            accept={accept}
            disabled={busy}
            className="sr-only"
            aria-label={label}
            onChange={(event) => void onChange(event.target.files?.[0])}
          />
        </label>
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

function ApplicationBanner({ profile }: { profile: ProviderProfile | null | undefined }) {
  if (!profile || profile.status === "DRAFT") {
    return (
      <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
        Complete your{" "}
        <Link href="/physio/profile/" className="font-semibold underline">
          profile and documents
        </Link>{" "}
        and submit them to start getting patients.
      </p>
    );
  }
  if (profile.status === "PENDING") {
    return (
      <p className="mt-4 rounded-xl bg-stone-100 p-4 text-sm text-stone-700 ring-1 ring-stone-200">
        Your application is being reviewed. Our team will check your documents and arrange an in-person meeting.
      </p>
    );
  }
  if (profile.status === "REJECTED" || profile.status === "SUSPENDED") {
    return (
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-100">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Your account is {profile.status === "REJECTED" ? "not approved" : "suspended"}.
          {profile.status_reason ? ` Reason: ${profile.status_reason}` : ""}
          {profile.status === "REJECTED" ? (
            <>
              {" "}
              <Link href="/physio/profile/" className="font-semibold underline">
                Update and resubmit
              </Link>
            </>
          ) : null}
        </span>
      </p>
    );
  }
  return null;
}

// Jobs ---------------------------------------------------------------------------------------------

export function PhysioJobsPage() {
  return (
    <PhysioPage>
      <JobsContent />
    </PhysioPage>
  );
}

function JobsContent() {
  const profile = useProviderProfile();
  const jobs = useJobs(Boolean(profile.data));
  const wallet = useWallet(Boolean(profile.data));
  const items = jobs.data?.items ?? [];
  const offers = items.filter((job) => job.status === "AWAITING_ACCEPTANCE");
  const active = items.filter((job) => job.status === "ACTIVE");
  const past = items.filter((job) => job.status === "COMPLETED" || job.status === "CANCELLED");

  if (profile.isPending) return <Skeleton className="h-40 w-full" />;
  if (profile.isError) return <ErrorState onRetry={() => void profile.refetch()} />;

  return (
    <>
      <PageHeader title="Jobs" />
      <ApplicationBanner profile={profile.data} />
      {wallet.data && !wallet.data.can_accept_orders && profile.data?.status === "APPROVED" ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
          Your balance is {formatPkr(wallet.data.balance_pkr)}, below the {formatPkr(wallet.data.minimum_balance_pkr)}{" "}
          minimum, so you won&apos;t get new orders.{" "}
          <Link href="/physio/balance/" className="font-semibold underline">
            Top up
          </Link>
        </p>
      ) : null}
      {profile.data ? (
        jobs.isPending ? (
          <Card className="mt-4">
            <TableSkeleton rows={3} />
          </Card>
        ) : jobs.isError ? (
          <Card className="mt-4">
            <ErrorState onRetry={() => void jobs.refetch()} />
          </Card>
        ) : items.length === 0 ? (
          <Card className="mt-4">
            <EmptyState title="No jobs yet" description="New orders from patients will appear here." />
          </Card>
        ) : (
          <div className="mt-4 space-y-5">
            <JobGroup title="New offers" jobs={offers} />
            <JobGroup title="Active" jobs={active} />
            <JobGroup title="Past" jobs={past} />
          </div>
        )
      ) : null}
    </>
  );
}

function JobGroup({ title, jobs }: { title: string; jobs: BookingView[] }) {
  if (jobs.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold text-stone-600">{title}</h2>
      <div className="mt-2 space-y-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </section>
  );
}

function age(birthYear: number | null) {
  return birthYear ? `, about ${new Date().getFullYear() - birthYear} years old` : "";
}

function JobCard({ job }: { job: BookingView }) {
  const respond = useRespondToOffer();
  const [rejecting, setRejecting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const offer = job.status === "AWAITING_ACCEPTANCE";
  const used = job.sessions.filter((s) => ["SCHEDULED", "ON_THE_WAY", "ARRIVED", "COMPLETED"].includes(s.status)).length;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-stone-500">Order KC-{job.number}</p>
        <BookingStatusBadge status={job.status} />
      </div>
      <h3 className="mt-1 font-semibold text-stone-900">{job.service_name}</h3>
      <p className="text-sm text-stone-600">
        {job.patient.name}, {job.patient.gender === "FEMALE" ? "female" : "male"}
        {age(job.patient.birth_year)}
      </p>
      <p className="mt-1 text-sm text-stone-600">
        {job.area_name}
        {job.address_line ? ` · ${job.address_line}` : " · Full address after you accept"}
      </p>
      <p className="mt-1 text-sm text-stone-600">
        {job.sessions_count} {job.sessions_count === 1 ? "session" : "sessions"} · {formatPkr(job.price_total_pkr)} cash from
        the patient
      </p>
      <p className="mt-2 rounded-lg bg-stone-50 p-3 text-sm text-stone-700">{job.condition}</p>

      {offer ? (
        <>
          <p className="mt-2 text-sm font-medium text-stone-800">Requested: {formatDateTime(job.preferred_start_at)}</p>
          <div className="mt-3">
            <FormError message={respond.isError ? errorMessage(respond.error) : null} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: job.id, accept: true })}
              className={adminButton("primary")}
            >
              Accept
            </button>
            <button type="button" onClick={() => setRejecting(true)} className={adminButton("secondary")}>
              Reject
            </button>
          </div>
        </>
      ) : null}

      {job.sessions.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {job.sessions.map((session) => (
            <JobSession key={session.id} session={session} />
          ))}
        </ul>
      ) : null}

      {job.status === "ACTIVE" && used < job.sessions_count ? (
        <button type="button" onClick={() => setScheduling(true)} className={adminButton("secondary", "mt-3")}>
          <Plus className="size-4" aria-hidden="true" />
          Schedule next session
        </button>
      ) : null}

      {rejecting ? (
        <ReasonDialog
          title="Reject this order?"
          label="Why can't you take it?"
          confirm="Reject order"
          pending={respond.isPending}
          error={respond.error}
          onClose={() => setRejecting(false)}
          onConfirm={(reason) =>
            respond.mutate({ id: job.id, accept: false, reason }, { onSuccess: () => setRejecting(false) })
          }
        />
      ) : null}
      {scheduling ? <ScheduleDialog bookingId={job.id} onClose={() => setScheduling(false)} /> : null}
    </Card>
  );
}

function ScheduleDialog({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const id = useId();
  const schedule = useScheduleSession();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState<string>();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!value) {
      setInvalid("Choose a date and time.");
      return;
    }
    setInvalid(undefined);
    // Treated as Pakistan time, which is what the physiotherapist means when picking a time.
    schedule.mutate({ id: bookingId, start_at: `${value}:00+05:00` }, { onSuccess: onClose });
  };

  return (
    <Modal title="Schedule next session" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id={id} label="Date and time" hint="Must be within your availability." error={invalid}>
          <input
            id={id}
            type="datetime-local"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={Boolean(invalid)}
            className={adminInput}
          />
        </FormField>
        <FormError message={schedule.isError ? errorMessage(schedule.error) : null} />
        <button type="submit" disabled={schedule.isPending} className={adminButton("primary", "w-full")}>
          Schedule
        </button>
      </form>
    </Modal>
  );
}

const NEXT_STEP: Partial<Record<SessionView["status"], { status: string; label: string }>> = {
  SCHEDULED: { status: "ON_THE_WAY", label: "I'm on the way" },
  ON_THE_WAY: { status: "ARRIVED", label: "I've arrived" },
  ARRIVED: { status: "COMPLETED", label: "Complete session" },
};

function JobSession({ session }: { session: SessionView }) {
  const advance = useAdvanceSession();
  const cancel = useCancelJobSession();
  const [dialog, setDialog] = useState<"cancel" | "complete" | null>(null);
  const step = NEXT_STEP[session.status];

  return (
    <li className="rounded-lg p-3 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-stone-900">
          Session {session.sequence} · {formatDateTime(session.scheduled_at)}
        </p>
        <SessionStatusBadge status={session.status} />
      </div>
      <ContactLine session={session} who="family" />
      {session.status === "COMPLETED" && session.pain_score !== null ? (
        <p className="mt-2 text-sm text-stone-600">
          Pain score {session.pain_score} of 10{session.rating ? ` · Rated ${session.rating} of 5` : ""}
        </p>
      ) : null}
      {step ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={advance.isPending}
            onClick={() =>
              step.status === "COMPLETED"
                ? setDialog("complete")
                : advance.mutate({ id: session.id, status: step.status })
            }
            className={adminButton("primary")}
          >
            {step.label}
          </button>
          {session.can_cancel ? (
            <button type="button" onClick={() => setDialog("cancel")} className={adminButton("ghost")}>
              Cancel session
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2 empty:hidden">{advance.isError ? <FormError message={errorMessage(advance.error)} /> : null}</div>
      {dialog === "cancel" ? (
        <ReasonDialog
          title="Cancel this session?"
          label="Why are you cancelling?"
          confirm="Cancel session"
          pending={cancel.isPending}
          error={cancel.error}
          onClose={() => setDialog(null)}
          onConfirm={(reason) => cancel.mutate({ id: session.id, reason }, { onSuccess: () => setDialog(null) })}
        />
      ) : null}
      {dialog === "complete" ? <CompleteDialog sessionId={session.id} onClose={() => setDialog(null)} /> : null}
    </li>
  );
}

function CompleteDialog({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const id = useId();
  const advance = useAdvanceSession();
  const [pain, setPain] = useState("");
  const [notes, setNotes] = useState("");
  const [invalid, setInvalid] = useState<string>();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const score = Number(pain);
    if (pain === "" || !Number.isInteger(score) || score < 0 || score > 10) {
      setInvalid("Enter a whole number from 0 to 10.");
      return;
    }
    setInvalid(undefined);
    advance.mutate(
      { id: sessionId, status: "COMPLETED", pain_score: score, notes: notes.trim() || undefined },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal title="Complete session" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id={`${id}-pain`} label="Patient's pain score (0 to 10)" error={invalid}>
          <input
            id={`${id}-pain`}
            inputMode="numeric"
            autoFocus
            value={pain}
            onChange={(event) => setPain(event.target.value)}
            aria-invalid={Boolean(invalid)}
            className={adminInput}
          />
        </FormField>
        <FormField id={`${id}-notes`} label="Session notes">
          <textarea
            id={`${id}-notes`}
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={`${adminInput} h-auto py-2`}
          />
        </FormField>
        <p className="text-xs text-stone-500">Our commission is deducted from your balance when you complete this.</p>
        <FormError message={advance.isError ? errorMessage(advance.error) : null} />
        <button type="submit" disabled={advance.isPending} className={adminButton("primary", "w-full")}>
          Complete session
        </button>
      </form>
    </Modal>
  );
}

// Profile ------------------------------------------------------------------------------------------

export function PhysioProfilePage() {
  return (
    <PhysioPage>
      <ProfileContent />
    </PhysioPage>
  );
}

const profileSchema = z.object({
  cnic: z
    .string()
    .trim()
    .refine((value) => /^\d{13}$/.test(value.replace(/[-\s]/g, "")), "Enter your 13-digit CNIC number.")
    .optional(),
  qualification: z.string().trim().min(2, "Enter your qualification, e.g. DPT."),
  experience: z.coerce
    .number<string>("Enter a number.")
    .int("Enter whole years.")
    .min(0, "Must be 0 or more.")
    .max(60, "Must be 60 or less."),
});

const DOCUMENTS: { type: DocumentType; label: string }[] = [
  { type: "CNIC_FRONT", label: "CNIC front" },
  { type: "CNIC_BACK", label: "CNIC back" },
  { type: "DEGREE", label: "Physiotherapy degree" },
  { type: "LICENSE", label: "License or registration (optional)" },
];

function ProfileContent() {
  const profile = useProviderProfile();
  const catalog = useCatalog();
  if (profile.isPending || catalog.isPending) return <Skeleton className="h-96 w-full" />;
  if (profile.isError) return <ErrorState onRetry={() => void profile.refetch()} />;
  // The key resets the form once a saved profile arrives.
  return <ProfileForm key={profile.data?.id ?? "new"} profile={profile.data} />;
}

function ProfileForm({ profile }: { profile: ProviderProfile | null }) {
  const id = useId();
  const catalog = useCatalog();
  const save = useSaveProfile();
  const attach = useAttachDocument();
  const submit = useSubmitApplication();
  const frozen = profile !== null && ["PENDING", "APPROVED", "SUSPENDED"].includes(profile.status);
  const [gender, setGender] = useState<Gender>(profile?.gender ?? "FEMALE");
  const [cnic, setCnic] = useState("");
  const [qualification, setQualification] = useState(profile?.qualification ?? "");
  const [experience, setExperience] = useState(profile ? String(profile.experience_years) : "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [photoId, setPhotoId] = useState(profile?.photo_file_id ?? null);
  const [services, setServices] = useState<string[]>(profile?.service_type_ids ?? []);
  const [areas, setAreas] = useState<string[]>(profile?.area_ids ?? []);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saved, setSaved] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const onSave = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    // The stored CNIC never comes back to the browser, so leaving this empty keeps it.
    const newCnic = cnic.trim() || undefined;
    const parsed = profileSchema.safeParse({ cnic: newCnic, qualification, experience });
    const next: Record<string, string | undefined> = {};
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      next.cnic = fields.cnic?.[0];
      next.qualification = fields.qualification?.[0];
      next.experience = fields.experience?.[0];
    }
    if (!profile && !newCnic) next.cnic = "Enter your 13-digit CNIC number.";
    if (services.length === 0) next.services = "Choose at least one treatment.";
    if (areas.length === 0) next.areas = "Choose at least one area.";
    setErrors(next);
    if (!parsed.success || Object.values(next).some(Boolean)) return;
    save.mutate(
      {
        gender,
        cnic: newCnic ?? null,
        qualification: parsed.data.qualification,
        experience_years: parsed.data.experience,
        bio: bio.trim() || null,
        photo_file_id: photoId,
        service_type_ids: services,
        area_ids: areas,
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  const documents = new Set(profile?.documents.map((document) => document.type));
  const ready =
    profile?.photo_file_id && documents.has("CNIC_FRONT") && documents.has("CNIC_BACK") && documents.has("DEGREE");
  const canSubmit = profile?.status === "DRAFT" || profile?.status === "REJECTED";

  return (
    <>
      <PageHeader title="Your profile" description="Patients see your name, photo, experience and availability. Never your number." />
      <ApplicationBanner profile={profile} />
      {profile?.status === "APPROVED" ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-800">
          <BadgeCheck className="size-4" aria-hidden="true" />
          Verified
        </p>
      ) : null}
      <form onSubmit={onSave} noValidate className="mt-4 space-y-4">
        <Card className="space-y-4 p-4">
          <FileButton
            label="Your photo"
            accept={IMAGE_ACCEPT}
            purpose="PROVIDER_PHOTO"
            done={Boolean(photoId)}
            onUploaded={(fileId) => setPhotoId(fileId)}
          />
          {profile?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={storageUrl(profile.photo_url)} alt="Your current photo" className="size-20 rounded-xl object-cover" />
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id={`${id}-gender`} label="Gender">
              <select
                id={`${id}-gender`}
                value={gender}
                disabled={frozen}
                onChange={(event) => setGender(event.target.value as Gender)}
                className={adminInput}
              >
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
              </select>
            </FormField>
            <FormField
              id={`${id}-cnic`}
              label="CNIC number"
              hint={profile ? `On file: ${profile.cnic_masked}. Leave empty to keep it. Encrypted, and shown only to our verification team.` : "Encrypted, and shown only to our verification team."}
              error={errors.cnic}
            >
              <input
                id={`${id}-cnic`}
                inputMode="numeric"
                disabled={frozen}
                value={cnic}
                onChange={(event) => setCnic(event.target.value)}
                placeholder="35202-1234567-1"
                aria-invalid={Boolean(errors.cnic)}
                className={adminInput}
              />
            </FormField>
            <FormField id={`${id}-qual`} label="Qualification" error={errors.qualification}>
              <input
                id={`${id}-qual`}
                disabled={frozen}
                value={qualification}
                onChange={(event) => setQualification(event.target.value)}
                placeholder="DPT"
                aria-invalid={Boolean(errors.qualification)}
                className={adminInput}
              />
            </FormField>
            <FormField id={`${id}-exp`} label="Years of experience" error={errors.experience}>
              <input
                id={`${id}-exp`}
                inputMode="numeric"
                disabled={frozen}
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                aria-invalid={Boolean(errors.experience)}
                className={adminInput}
              />
            </FormField>
          </div>
          <FormField id={`${id}-bio`} label="About you (optional)">
            <textarea
              id={`${id}-bio`}
              rows={3}
              maxLength={1000}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className={`${adminInput} h-auto py-2`}
            />
          </FormField>
        </Card>

        <Card className="space-y-4 p-4">
          <ChipGroup
            legend="Treatments you offer"
            error={errors.services}
            options={catalog.data?.services ?? []}
            selected={services}
            onToggle={(value) => setServices((list) => toggle(list, value))}
          />
          <ChipGroup
            legend="Areas you cover"
            error={errors.areas}
            options={catalog.data?.areas ?? []}
            selected={areas}
            onToggle={(value) => setAreas((list) => toggle(list, value))}
          />
        </Card>

        <FormError message={save.isError ? errorMessage(save.error) : null} />
        {saved ? <p role="status" className="text-sm font-medium text-brand-800">Profile saved.</p> : null}
        <button type="submit" disabled={save.isPending} className={adminButton("primary", "w-full")}>
          {save.isPending ? "Saving..." : "Save profile"}
        </button>
      </form>

      {profile && canSubmit ? (
        <Card className="mt-4 space-y-3 p-4">
          <h2 className="font-semibold text-stone-900">Verification documents</h2>
          {DOCUMENTS.map((document) => (
            <FileButton
              key={document.type}
              label={document.label}
              accept={DOCUMENT_ACCEPT}
              purpose="PROVIDER_DOCUMENT"
              done={documents.has(document.type)}
              onUploaded={(fileId) => attach.mutateAsync({ type: document.type, file_id: fileId })}
            />
          ))}
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1"
            />
            <span>
              I agree to the physiotherapist agreement: I keep a prepaid balance, our commission is deducted after each
              session, I collect the stated price in cash, and I serve Khidmat Care patients only through this platform.
            </span>
          </label>
          <FormError message={submit.isError ? errorMessage(submit.error) : null} />
          <button
            type="button"
            disabled={!ready || !agreed || submit.isPending}
            onClick={() => submit.mutate(undefined)}
            className={adminButton("primary", "w-full")}
          >
            Submit for review
          </button>
          {!ready ? (
            <p className="text-xs text-stone-500">
              Save your photo and upload both CNIC sides and your degree to submit.
            </p>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

function ChipGroup({
  legend,
  options,
  selected,
  error,
  onToggle,
}: {
  legend: string;
  options: { id: string; name: string }[];
  selected: string[];
  error?: string;
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-stone-700">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 text-sm ring-1 transition",
              selected.includes(option.id)
                ? "bg-brand-50 font-medium text-brand-900 ring-2 ring-brand-600"
                : "text-stone-700 ring-stone-200 hover:bg-stone-50",
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={selected.includes(option.id)}
              onChange={() => onToggle(option.id)}
            />
            {option.name}
          </label>
        ))}
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </fieldset>
  );
}

// Availability -------------------------------------------------------------------------------------

export function PhysioAvailabilityPage() {
  return (
    <PhysioPage>
      <AvailabilityContent />
    </PhysioPage>
  );
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_OPTIONS = Array.from({ length: 33 }, (_, index) => 360 + index * 30); // 6am to 10pm.

function AvailabilityContent() {
  const profile = useProviderProfile();
  if (profile.isPending) return <Skeleton className="h-96 w-full" />;
  if (!profile.data) {
    return (
      <>
        <PageHeader title="Availability" />
        <ApplicationBanner profile={null} />
      </>
    );
  }
  return <AvailabilityForm key={profile.data.id} initial={profile.data.availability} />;
}

function AvailabilityForm({ initial }: { initial: AvailabilitySlot[] }) {
  const save = useSaveAvailability();
  const [slots, setSlots] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);

  const update = (index: number, change: Partial<AvailabilitySlot>) => {
    setSaved(false);
    setSlots((list) => list.map((slot, i) => (i === index ? { ...slot, ...change } : slot)));
  };

  const onSave = () => {
    if (slots.some((slot) => slot.end_minute <= slot.start_minute)) {
      setInvalid("Each end time must be after its start time.");
      return;
    }
    setInvalid(null);
    save.mutate(slots, { onSuccess: () => setSaved(true) });
  };

  return (
    <>
      <PageHeader title="Availability" description="Patients can only book you within these hours. Times are Pakistan time." />
      <div className="mt-4 space-y-3">
        {DAY_NAMES.map((name, day) => (
          <Card key={name} className="p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-900">{name}</h2>
              <button
                type="button"
                aria-label={`Add hours on ${name}`}
                onClick={() => {
                  setSaved(false);
                  setSlots((list) => [...list, { day_of_week: day, start_minute: 540, end_minute: 1020 }]);
                }}
                className={adminButton("ghost")}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add
              </button>
            </div>
            {slots.every((slot) => slot.day_of_week !== day) ? (
              <p className="text-xs text-stone-500">Not available</p>
            ) : null}
            <ul className="mt-1 space-y-2">
              {slots.map((slot, index) =>
                slot.day_of_week === day ? (
                  <li key={index} className="flex items-center gap-2">
                    <TimeSelect
                      label={`${name} start`}
                      value={slot.start_minute}
                      onChange={(value) => update(index, { start_minute: value })}
                    />
                    <span className="text-sm text-stone-500">to</span>
                    <TimeSelect
                      label={`${name} end`}
                      value={slot.end_minute}
                      onChange={(value) => update(index, { end_minute: value })}
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${name} hours`}
                      onClick={() => {
                        setSaved(false);
                        setSlots((list) => list.filter((_, i) => i !== index));
                      }}
                      className={adminButton("ghost", "w-9 shrink-0 px-0")}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
          </Card>
        ))}
        <FormError message={invalid ?? (save.isError ? errorMessage(save.error) : null)} />
        {saved ? <p role="status" className="text-sm font-medium text-brand-800">Availability saved.</p> : null}
        <button type="button" disabled={save.isPending} onClick={onSave} className={adminButton("primary", "w-full")}>
          Save availability
        </button>
      </div>
    </>
  );
}

function TimeSelect({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(Number(event.target.value))} className={adminInput}>
      {TIME_OPTIONS.map((minute) => (
        <option key={minute} value={minute}>
          {minuteLabel(minute)}
        </option>
      ))}
    </select>
  );
}

// Balance ------------------------------------------------------------------------------------------

export function PhysioBalancePage() {
  return (
    <PhysioPage>
      <BalanceContent />
    </PhysioPage>
  );
}

const TOPUP_BADGE = {
  PENDING: (
    <Badge tone="attention" icon={Clock}>
      Being checked
    </Badge>
  ),
  APPROVED: (
    <Badge tone="good" icon={BadgeCheck}>
      Added
    </Badge>
  ),
  REJECTED: <Badge icon={X}>Rejected</Badge>,
};

const TRANSACTION_LABEL = { TOPUP: "Top-up", COMMISSION: "Commission", ADJUSTMENT: "Correction" };

function BalanceContent() {
  const profile = useProviderProfile();
  const has = Boolean(profile.data);
  const wallet = useWallet(has);
  const history = useWalletHistory(has);
  const topups = useMyTopups(has);
  const [adding, setAdding] = useState(false);

  if (profile.isPending) return <Skeleton className="h-64 w-full" />;
  if (!has) {
    return (
      <>
        <PageHeader title="Balance" />
        <ApplicationBanner profile={null} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Balance"
        actions={
          <button type="button" onClick={() => setAdding(true)} className={adminButton("primary")}>
            Top up
          </button>
        }
      />
      <Card className="mt-4 p-5">
        <p className="text-sm text-stone-600">Your balance</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-stone-900 tabular-nums">
          {wallet.data ? formatPkr(wallet.data.balance_pkr) : "-"}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          {wallet.data
            ? wallet.data.can_accept_orders
              ? `You can accept orders. The minimum is ${formatPkr(wallet.data.minimum_balance_pkr)}.`
              : `Top up to at least ${formatPkr(wallet.data.minimum_balance_pkr)} to accept new orders.`
            : ""}
        </p>
      </Card>
      {topups.data && topups.data.items.length > 0 ? (
        <Card className="mt-4">
          <h2 className="border-b border-stone-200 p-4 text-sm font-semibold text-stone-900">Top-up requests</h2>
          <ul className="divide-y divide-stone-100">
            {topups.data.items.map((topup) => (
              <li key={topup.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span>
                  <span className="font-medium text-stone-900">{formatPkr(topup.amount_pkr)}</span>
                  <span className="text-stone-500"> · {topup.method} · {topup.reference}</span>
                  {topup.reject_reason ? <span className="block text-xs text-red-700">{topup.reject_reason}</span> : null}
                </span>
                {TOPUP_BADGE[topup.status]}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card className="mt-4">
        <h2 className="border-b border-stone-200 p-4 text-sm font-semibold text-stone-900">History</h2>
        {history.data && history.data.items.length > 0 ? (
          <ul className="divide-y divide-stone-100">
            {history.data.items.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span>
                  <span className="font-medium text-stone-900">{TRANSACTION_LABEL[row.type]}</span>
                  <span className="block text-xs text-stone-500">{formatDateTime(row.created_at)}</span>
                  {row.note ? <span className="block text-xs text-stone-500">{row.note}</span> : null}
                </span>
                <span className="text-end tabular-nums">
                  <span className="font-medium text-stone-900">
                    {row.amount_pkr > 0 ? "+" : "-"}
                    {formatPkr(Math.abs(row.amount_pkr))}
                  </span>
                  <span className="block text-xs text-stone-500">Balance {formatPkr(row.balance_after_pkr)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No balance activity yet" />
        )}
      </Card>
      {adding ? <TopupDialog instructions={wallet.data?.topup_instructions ?? ""} onClose={() => setAdding(false)} /> : null}
    </>
  );
}

const topupSchema = z.object({
  amount: z.coerce
    .number<string>("Enter an amount.")
    .int("Enter whole rupees.")
    .min(1, "Enter an amount above 0.")
    .max(1_000_000, "This amount is too high."),
  method: z.string().trim().min(2, "Choose how you paid."),
  reference: z.string().trim().min(3, "Enter the transaction ID."),
});

function TopupDialog({ instructions, onClose }: { instructions: string; onClose: () => void }) {
  const id = useId();
  const request = useRequestTopup();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("JazzCash");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = topupSchema.safeParse({ amount, method, reference });
    const next: Record<string, string | undefined> = {};
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      next.amount = fields.amount?.[0];
      next.reference = fields.reference?.[0];
    }
    if (!proof) next.proof = "Upload a screenshot of the payment.";
    setErrors(next);
    if (!parsed.success || !proof) return;
    request.mutate(
      { amount_pkr: parsed.data.amount, method: parsed.data.method, reference: parsed.data.reference, proof_file_id: proof },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal title="Top up your balance" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <p className="rounded-lg bg-stone-50 p-3 text-sm whitespace-pre-wrap text-stone-700 ring-1 ring-stone-200">
          {instructions || "Message our support on WhatsApp for the payment details."}
        </p>
        <FormField id={`${id}-amount`} label="Amount sent (PKR)" error={errors.amount}>
          <input
            id={`${id}-amount`}
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={Boolean(errors.amount)}
            className={adminInput}
          />
        </FormField>
        <FormField id={`${id}-method`} label="Paid with">
          <select id={`${id}-method`} value={method} onChange={(event) => setMethod(event.target.value)} className={adminInput}>
            <option>JazzCash</option>
            <option>Easypaisa</option>
            <option>Bank transfer</option>
          </select>
        </FormField>
        <FormField id={`${id}-ref`} label="Transaction ID" error={errors.reference}>
          <input
            id={`${id}-ref`}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            aria-invalid={Boolean(errors.reference)}
            className={adminInput}
          />
        </FormField>
        <div>
          <FileButton
            label="Payment screenshot"
            accept={DOCUMENT_ACCEPT}
            purpose="TOPUP_PROOF"
            done={Boolean(proof)}
            onUploaded={(fileId) => setProof(fileId)}
          />
          {errors.proof ? <p className="mt-1 text-xs font-medium text-red-600">{errors.proof}</p> : null}
        </div>
        <FormError message={request.isError ? errorMessage(request.error as ApiError) : null} />
        <button type="submit" disabled={request.isPending} className={adminButton("primary", "w-full")}>
          Send for approval
        </button>
      </form>
    </Modal>
  );
}
