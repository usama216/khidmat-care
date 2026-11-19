"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarDays, Home, PencilLine, UsersRound } from "lucide-react";
import { z } from "zod";
import {
  adminButton,
  adminInput,
  Card,
  errorMessage,
  FormError,
  FormField,
  Skeleton,
} from "@/components/admin/ui";
import { BookingCalendar } from "@/components/calendar/BookingCalendar";
import { type CurrentUser, useCurrentUser } from "@/features/auth/auth";
import { ApiError, apiPost } from "@/lib/api";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import {
  addDays,
  dayKey,
  formatDayLong,
  formatDayShort,
  formatTime,
  lahoreIso,
  minuteLabel,
  minuteOfDay,
  todayKey,
} from "@/lib/dates";
import { formatPkr } from "@/lib/format";
import {
  type CatalogService,
  type PhysioProfile,
  type VisitType,
  useAddPerson,
  useCatalog,
  useCreateBooking,
  usePeople,
  usePhysioProfile,
} from "./api";
import { PhysioPhoto } from "./FindPage";
import { EmergencyLine, homeFor, PortalPage } from "./PortalShell";

const PHONE = /^(03\d{9}|(\+|00)[1-9]\d{7,14})$/;

const accountSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z
    .string()
    .trim()
    .refine((value) => PHONE.test(value.replace(/[\s()-]/g, "")), "Enter a valid phone number, e.g. 0300 1234567."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

const RELATIONS = [
  { value: "PARENT", label: "Parent" },
  { value: "SPOUSE", label: "Spouse" },
  { value: "CHILD", label: "Child" },
  { value: "SIBLING", label: "Sibling" },
  { value: "OTHER", label: "Other" },
];

// Times offered for a request, every hour from 7 am to 9 pm.
const REQUEST_TIMES = Array.from({ length: 15 }, (_, index) => 420 + index * 60);

type Errors = Partial<Record<string, string>>;

export function BookPage() {
  return (
    <PortalPage>
      <BookFlow />
    </PortalPage>
  );
}

function BookFlow() {
  const params = useSearchParams();
  const me = useCurrentUser();
  const physioId = params.get("physio");
  const isRequest = params.get("request") === "1";
  const physio = usePhysioProfile(physioId);
  const catalog = useCatalog();

  if (!physioId && !isRequest) {
    return (
      <Card className="p-6 text-center">
        <p className="font-semibold text-stone-900">Choose a physiotherapist first</p>
        <Link href="/physiotherapists/" className={adminButton("primary", "mt-4")}>
          See physiotherapists
        </Link>
      </Card>
    );
  }
  if (me.isPending || catalog.isPending || (physioId && physio.isPending)) {
    return (
      <div role="status" aria-label="Loading" className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (catalog.isError) return <FormError message="This page couldn't load. Please refresh." />;
  if (physioId && !physio.data) {
    return (
      <Card className="p-6 text-center">
        <p className="font-semibold text-stone-900">This physiotherapist isn&apos;t taking bookings right now</p>
        <Link href="/physiotherapists/" className={adminButton("primary", "mt-4")}>
          Choose another physiotherapist
        </Link>
      </Card>
    );
  }
  if (me.data && me.data.role !== "PATIENT") {
    return (
      <Card className="p-6 text-center">
        <p className="font-semibold text-stone-900">Bookings are made from a patient account</p>
        <p className="mt-1 text-sm text-stone-600">You&apos;re signed in as a {me.data.role === "PROVIDER" ? "physiotherapist" : "staff member"}.</p>
        <Link href={homeFor(me.data)} className={adminButton("secondary", "mt-4")}>
          Go to your dashboard
        </Link>
      </Card>
    );
  }
  return (
    <BookForm
      user={me.data ?? null}
      physio={physio.data ?? null}
      services={catalog.data.services}
      areas={catalog.data.areas}
    />
  );
}

function BookForm({
  user,
  physio,
  services: allServices,
  areas: allAreas,
}: {
  user: CurrentUser | null;
  physio: PhysioProfile | null;
  services: CatalogService[];
  areas: { id: string; name: string }[];
}) {
  const id = useId();
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const people = usePeople(Boolean(user));
  const addPerson = useAddPerson();
  const create = useCreateBooking();

  const services = allServices.filter(
    (item) => item.packages.length > 0 && (!physio || physio.service_type_ids.includes(item.id)),
  );
  const visitOptions: VisitType[] = physio
    ? ([physio.visit_home ? "HOME" : null, physio.visit_clinic ? "CLINIC" : null].filter(Boolean) as VisitType[])
    : ["HOME"];
  const requestedVisit = params.get("visit") as VisitType | null;

  const [serviceId, setServiceId] = useState(() => {
    const wanted = params.get("service");
    return services.some((item) => item.id === wanted) ? (wanted as string) : services.length === 1 ? services[0].id : "";
  });
  const [sessions, setSessions] = useState<number | null>(null);
  const [visit, setVisit] = useState<VisitType>(
    requestedVisit && visitOptions.includes(requestedVisit) ? requestedVisit : visitOptions[0],
  );
  const [startAt, setStartAt] = useState<string | null>(params.get("start"));
  const [changingTime, setChangingTime] = useState(!params.get("start"));
  const [requestDay, setRequestDay] = useState(() => dayKey(params.get("start") ?? lahoreIso(addDays(todayKey(), 1), 600)));
  const [requestMinute, setRequestMinute] = useState(() => {
    const start = params.get("start");
    const minute = start ? minuteOfDay(start) : 600;
    return REQUEST_TIMES.includes(minute) ? minute : 600;
  });

  const areas = physio && visit === "HOME" ? allAreas.filter((item) => physio.area_ids.includes(item.id)) : allAreas;
  const [areaId, setAreaId] = useState(() => {
    const wanted = params.get("area");
    return areas.some((item) => item.id === wanted) ? (wanted as string) : "";
  });
  const [address, setAddress] = useState("");
  const [condition, setCondition] = useState("");
  const [personChoice, setPersonId] = useState<string | null>(null);
  const [person, setPerson] = useState({ name: "", gender: "FEMALE", birth_year: "", relation: "PARENT" });
  const [account, setAccount] = useState({ name: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [accountError, setAccountError] = useState<ApiError | null>(null);

  // The patient's own record, once they have one, is the usual choice.
  const personId = personChoice ?? people.data?.find((item) => item.relation === "SELF")?.id ?? "SELF_NEW";

  const service = services.find((item) => item.id === serviceId);
  const packages = service?.packages ?? [];
  const chosenPackage = packages.find((item) => item.sessions_count === sessions) ?? (packages.length === 1 ? packages[0] : undefined);
  const total = physio?.fee_pkr && chosenPackage ? physio.fee_pkr * chosenPackage.sessions_count : null;
  const isRequest = !physio;
  const requestStart = lahoreIso(requestDay, requestMinute);
  const finalStart = isRequest ? requestStart : startAt;
  const clinicArea = physio?.clinic_area_id ? allAreas.find((item) => item.id === physio.clinic_area_id) : undefined;
  const pending = create.isPending || addPerson.isPending;

  const register = useMutation<CurrentUser, ApiError, typeof account>({
    mutationFn: (body) => apiPost<CurrentUser>("/auth/register", { ...body, role: "PATIENT" }),
    onSuccess: (created) => {
      track("CompleteRegistration", { content_name: "patient" });
      client.setQueryData(["auth", "me"], created);
    },
  });

  const validate = () => {
    const next: Errors = {};
    if (!serviceId) next.service = "Choose the treatment.";
    if (!chosenPackage) next.package = "Choose how many sessions.";
    if (!finalStart) next.slot = "Choose a date and time.";
    if (visit === "HOME" && !areaId) next.area = "Choose your area.";
    if (visit === "HOME" && address.trim().length < 5) next.address = "Enter the full address.";
    if (condition.trim().length < 3) next.condition = "Describe the problem briefly.";
    const forSomeoneElse = personId === "OTHER_NEW";
    if (forSomeoneElse && person.name.trim().length < 2) next.person = "Enter the patient's name.";
    const year = Number(person.birth_year);
    if (forSomeoneElse && person.birth_year && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())) {
      next.birth = "Enter a valid year, e.g. 1960.";
    }
    if (!user) {
      const parsed = accountSchema.safeParse(account);
      if (!parsed.success) {
        const fields = parsed.error.flatten().fieldErrors;
        next.accountName = fields.name?.[0];
        next.accountPhone = fields.phone?.[0];
        next.accountPassword = fields.password?.[0];
      }
    }
    return next;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.values(next).some(Boolean) || !chosenPackage || !finalStart) return;
    setAccountError(null);

    try {
      let ownName = user?.name ?? null;
      if (!user) {
        try {
          const created = await register.mutateAsync({
            name: account.name.trim(),
            phone: account.phone.trim(),
            password: account.password,
          });
          ownName = created.name;
        } catch (error) {
          setAccountError(error instanceof ApiError ? error : null);
          return;
        }
      }
      let patientId = personId;
      if (personId === "SELF_NEW" || personId === "OTHER_NEW") {
        const self = personId === "SELF_NEW";
        const created = await addPerson.mutateAsync({
          name: self ? (ownName ?? account.name.trim()) : person.name.trim(),
          gender: person.gender as "MALE" | "FEMALE",
          birth_year: !self && person.birth_year ? Number(person.birth_year) : null,
          relation: self ? "SELF" : person.relation,
        });
        patientId = created.id;
        setPersonId(created.id);
      }
      const booking = await create.mutateAsync({
        patient_id: patientId,
        service_type_id: serviceId,
        package_id: chosenPackage.id,
        provider_id: physio?.id,
        visit_type: visit,
        address_line: visit === "HOME" ? address.trim() : undefined,
        area_id: visit === "HOME" ? areaId : (physio?.clinic_area_id ?? areaId),
        start_at: finalStart,
        condition: condition.trim(),
      });
      track("Schedule", { content_name: isRequest ? "request" : "booking" });
      router.push(`/my/bookings/?placed=${booking.number}`);
    } catch {
      // Shown from the mutation's error state below.
    }
  };

  const signInHref = `/login/?next=${encodeURIComponent(`/book/?${params.toString()}`)}`;

  return (
    <>
      <h1 className="text-[1.45rem] font-semibold tracking-tight text-stone-900">
        {isRequest ? "Ask us to find a physiotherapist" : visit === "CLINIC" ? "Book a clinic visit" : "Book a home visit"}
      </h1>

      {physio ? (
        <Card className="mt-4 flex items-center gap-3 p-4">
          <PhysioPhoto url={physio.photo_url} name={physio.name ?? "Physiotherapist"} size="size-14" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-stone-900">{physio.name}</p>
            <p className="text-sm text-stone-600">
              {physio.qualification} · {physio.experience_years} years · {physio.slot_minutes}-minute sessions
            </p>
          </div>
          <p className="text-end">
            <span className="block text-xs text-stone-500">Per session</span>
            <span className="font-semibold text-stone-900 tabular-nums">{physio.fee_pkr ? formatPkr(physio.fee_pkr) : "-"}</span>
          </p>
        </Card>
      ) : (
        <Card className="mt-4 flex gap-3 p-4">
          <UsersRound className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden="true" />
          <p className="text-sm text-stone-700">
            We alert verified physiotherapists who treat this problem in your area and are free at your time. The first
            one to pick your request is booked, and you&apos;ll see their name and fee in your orders straight away. If
            nobody picks it, our team finds someone for you.
          </p>
        </Card>
      )}

      <form
        onSubmit={(event) => void onSubmit(event)}
        onChange={() => setErrors({})}
        noValidate
        className="mt-4 space-y-4"
      >
        <Step number={1} title="Date and time">
          {!physio ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id={`${id}-rday`} label="Preferred date">
                <select id={`${id}-rday`} value={requestDay} onChange={(e) => setRequestDay(e.target.value)} className={adminInput}>
                  {Array.from({ length: 14 }, (_, index) => addDays(todayKey(), index)).map((item) => (
                    <option key={item} value={item}>
                      {formatDayShort(item)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id={`${id}-rtime`} label="Preferred time">
                <select
                  id={`${id}-rtime`}
                  value={requestMinute}
                  onChange={(e) => setRequestMinute(Number(e.target.value))}
                  className={adminInput}
                >
                  {REQUEST_TIMES.map((minute) => (
                    <option key={minute} value={minute}>
                      {minuteLabel(minute)}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          ) : changingTime || !startAt ? (
            <BookingCalendar
              physioId={physio.id}
              value={startAt}
              onChange={(value) => {
                setStartAt(value);
                if (value) setChangingTime(false);
              }}
              initialDay={startAt ? dayKey(startAt) : undefined}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 ring-1 ring-brand-200">
              <p className="flex items-center gap-2 font-semibold text-brand-900">
                <CalendarDays className="size-5" aria-hidden="true" />
                {formatDayLong(dayKey(startAt))}, {formatTime(startAt)}
              </p>
              <button type="button" onClick={() => setChangingTime(true)} className={adminButton("secondary")}>
                <PencilLine className="size-4" aria-hidden="true" />
                Change
              </button>
            </div>
          )}
          {errors.slot ? <p className="mt-2 text-xs font-medium text-red-600">{errors.slot}</p> : null}
        </Step>

        <Step number={2} title="Treatment">
          <FormField id={`${id}-service`} label="What do you need help with?" error={errors.service}>
            <select
              id={`${id}-service`}
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
                setSessions(null);
              }}
              aria-invalid={Boolean(errors.service)}
              className={adminInput}
            >
              <option value="">Choose a treatment</option>
              {services.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          {packages.length > 1 ? (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-stone-700">How many sessions?</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {packages.map((item) => (
                  <label
                    key={item.id}
                    className={cn(
                      "cursor-pointer rounded-lg p-3 ring-1 transition",
                      chosenPackage?.id === item.id ? "bg-brand-50 ring-2 ring-brand-600" : "ring-stone-200 hover:bg-stone-50",
                    )}
                  >
                    <input
                      type="radio"
                      name="sessions"
                      className="sr-only"
                      checked={chosenPackage?.id === item.id}
                      onChange={() => setSessions(item.sessions_count)}
                    />
                    <span className="block text-sm font-semibold text-stone-900">
                      {item.sessions_count} {item.sessions_count === 1 ? "session" : "sessions"}
                    </span>
                    {physio?.fee_pkr ? (
                      <span className="block text-sm text-stone-600 tabular-nums">
                        {formatPkr(physio.fee_pkr * item.sessions_count)}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
              {errors.package ? <p className="mt-1 text-xs font-medium text-red-600">{errors.package}</p> : null}
            </fieldset>
          ) : null}
          <FormField id={`${id}-condition`} label="Describe the problem" error={errors.condition}>
            <textarea
              id={`${id}-condition`}
              rows={3}
              maxLength={2000}
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              placeholder="e.g. Knee replacement 3 weeks ago, can't bend the knee fully"
              aria-invalid={Boolean(errors.condition)}
              className={cn(adminInput, "h-auto py-2")}
            />
          </FormField>
        </Step>

        <Step number={3} title="Patient and place">
          {user ? (
            <FormField id={`${id}-person`} label="Who is this for?">
              <select id={`${id}-person`} value={personId} onChange={(event) => setPersonId(event.target.value)} className={adminInput}>
                {people.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.relation === "SELF" ? `Myself (${item.name})` : item.name}
                  </option>
                ))}
                {people.data?.some((item) => item.relation === "SELF") ? null : <option value="SELF_NEW">Myself</option>}
                <option value="OTHER_NEW">Someone else</option>
              </select>
            </FormField>
          ) : (
            <div role="group" aria-label="Who is this for?" className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1">
              {[
                { value: "SELF_NEW", label: "For me" },
                { value: "OTHER_NEW", label: "For someone else" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={personId === option.value}
                  onClick={() => setPersonId(option.value)}
                  className={cn(
                    "h-9 rounded-md text-sm font-medium transition",
                    personId === option.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {personId === "OTHER_NEW" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id={`${id}-pname`} label="Patient's name" error={errors.person}>
                <input
                  id={`${id}-pname`}
                  value={person.name}
                  onChange={(event) => setPerson((prev) => ({ ...prev, name: event.target.value }))}
                  aria-invalid={Boolean(errors.person)}
                  className={adminInput}
                />
              </FormField>
              <FormField id={`${id}-prelation`} label="They are your">
                <select
                  id={`${id}-prelation`}
                  value={person.relation}
                  onChange={(event) => setPerson((prev) => ({ ...prev, relation: event.target.value }))}
                  className={adminInput}
                >
                  {RELATIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id={`${id}-pyear`} label="Birth year (optional)" error={errors.birth}>
                <input
                  id={`${id}-pyear`}
                  inputMode="numeric"
                  value={person.birth_year}
                  onChange={(event) => setPerson((prev) => ({ ...prev, birth_year: event.target.value }))}
                  aria-invalid={Boolean(errors.birth)}
                  className={adminInput}
                />
              </FormField>
              <GenderField id={`${id}-pgender`} label="Patient's gender" value={person.gender} onChange={(gender) => setPerson((prev) => ({ ...prev, gender }))} />
            </div>
          ) : personId === "SELF_NEW" ? (
            <GenderField id={`${id}-sgender`} label="Your gender" value={person.gender} onChange={(gender) => setPerson((prev) => ({ ...prev, gender }))} />
          ) : null}

          {visitOptions.length > 1 ? (
            <div role="group" aria-label="Visit type" className="grid grid-cols-2 gap-2">
              {visitOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={visit === value}
                  onClick={() => setVisit(value)}
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold ring-1 transition",
                    visit === value ? "bg-brand-50 text-brand-900 ring-2 ring-brand-600" : "text-stone-700 ring-stone-200",
                  )}
                >
                  {value === "HOME" ? <Home className="size-4" aria-hidden="true" /> : <Building2 className="size-4" aria-hidden="true" />}
                  {value === "HOME" ? "Home visit" : "Clinic visit"}
                </button>
              ))}
            </div>
          ) : null}

          {visit === "HOME" ? (
            <>
              <FormField id={`${id}-area`} label="Area" error={errors.area}>
                <select
                  id={`${id}-area`}
                  value={areaId}
                  onChange={(event) => setAreaId(event.target.value)}
                  aria-invalid={Boolean(errors.area)}
                  className={adminInput}
                >
                  <option value="">{physio ? "Choose an area this physio covers" : "Choose your area"}</option>
                  {areas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                id={`${id}-address`}
                label="Full address"
                hint="Shared only after the physio confirms."
                error={errors.address}
              >
                <input
                  id={`${id}-address`}
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  aria-invalid={Boolean(errors.address)}
                  className={adminInput}
                />
              </FormField>
            </>
          ) : (
            <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700 ring-1 ring-stone-200">
              You&apos;ll visit the clinic{clinicArea ? ` in ${clinicArea.name}` : ""}. The full clinic address appears in your
              orders once the visit is confirmed.
            </p>
          )}
        </Step>

        {!user ? (
          <Step number={4} title="Your details">
            <p className="-mt-1 text-sm text-stone-600">
              We create your account with these, so you can follow and manage the booking. Already have one?{" "}
              <Link href={signInHref} className="font-semibold text-brand-700 hover:underline">
                Sign in
              </Link>
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id={`${id}-aname`} label="Your full name" error={errors.accountName}>
                <input
                  id={`${id}-aname`}
                  autoComplete="name"
                  value={account.name}
                  onChange={(event) => setAccount((prev) => ({ ...prev, name: event.target.value }))}
                  aria-invalid={Boolean(errors.accountName)}
                  className={adminInput}
                />
              </FormField>
              <FormField id={`${id}-aphone`} label="Phone (WhatsApp)" error={errors.accountPhone}>
                <input
                  id={`${id}-aphone`}
                  type="tel"
                  autoComplete="tel"
                  placeholder="0300 1234567"
                  value={account.phone}
                  onChange={(event) => setAccount((prev) => ({ ...prev, phone: event.target.value }))}
                  aria-invalid={Boolean(errors.accountPhone)}
                  className={adminInput}
                />
              </FormField>
              <FormField
                id={`${id}-apass`}
                label="Choose a password"
                hint="At least 8 characters."
                error={errors.accountPassword}
              >
                <input
                  id={`${id}-apass`}
                  type="password"
                  autoComplete="new-password"
                  value={account.password}
                  onChange={(event) => setAccount((prev) => ({ ...prev, password: event.target.value }))}
                  aria-invalid={Boolean(errors.accountPassword)}
                  className={adminInput}
                />
              </FormField>
            </div>
            {accountError ? (
              <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {accountError.status === 409 ? (
                  <>
                    This phone number already has an account.{" "}
                    <Link href={signInHref} className="font-semibold underline">
                      Sign in to continue
                    </Link>
                    . Your choices stay on this page.
                  </>
                ) : (
                  errorMessage(accountError)
                )}
              </div>
            ) : null}
          </Step>
        ) : null}

        <Card className="p-4">
          {total !== null ? (
            <p className="flex items-center justify-between font-semibold text-stone-900">
              <span>
                Total for {chosenPackage?.sessions_count} {chosenPackage?.sessions_count === 1 ? "session" : "sessions"}, paid in cash
                after each visit
              </span>
              <span className="tabular-nums">{formatPkr(total)}</span>
            </p>
          ) : isRequest ? (
            <p className="text-sm text-stone-700">The fee is the chosen physiotherapist&apos;s, shown as soon as one picks your request. You can cancel free if it doesn&apos;t suit you.</p>
          ) : null}
          <p className="mt-2 text-xs text-stone-500">
            {isRequest
              ? "Nearby physiotherapists are alerted now. "
              : "Your time is held while the physio confirms. "}
            You can cancel up to 2 hours before a session. Phone numbers are shared 2 hours before each session.
          </p>
          <div className="mt-3 space-y-3">
            <FormError
              message={addPerson.isError ? errorMessage(addPerson.error) : create.isError ? errorMessage(create.error) : null}
            />
            {create.isError && create.error.status === 409 && !isRequest ? (
              <button type="button" onClick={() => setChangingTime(true)} className={adminButton("secondary", "w-full")}>
                Choose another time
              </button>
            ) : null}
            <button type="submit" disabled={pending || register.isPending} className={adminButton("primary", "h-11 w-full")}>
              {register.isPending
                ? "Creating your account..."
                : pending
                  ? "Placing order..."
                  : isRequest
                    ? "Send my request"
                    : "Confirm booking"}
            </button>
          </div>
        </Card>
        <EmergencyLine />
      </form>
    </>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-2.5 font-semibold text-stone-900">
        <span className="grid size-6 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white" aria-hidden="true">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

function GenderField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField id={id} label={label}>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={adminInput}>
        <option value="FEMALE">Female</option>
        <option value="MALE">Male</option>
      </select>
    </FormField>
  );
}
