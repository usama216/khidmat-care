"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import {
  adminButton,
  adminInput,
  Card,
  errorMessage,
  FormError,
  FormField,
  PageHeader,
  Skeleton,
} from "@/components/admin/ui";
import { formatPkr } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  useAddPerson,
  useCatalog,
  useCreateBooking,
  usePeople,
  usePhysios,
  usePhysioSlots,
} from "./api";
import { PhysioPhoto } from "./FindPage";
import { EmergencyLine, PortalPage, RequireRole } from "./PortalShell";

const timeFormat = new Intl.DateTimeFormat("en-PK", { timeStyle: "short", timeZone: "Asia/Karachi" });

function nextDays(count: number) {
  const days: { value: string; label: string }[] = [];
  const format = new Intl.DateTimeFormat("en-PK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Karachi",
  });
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" });
  for (let index = 0; index < count; index += 1) {
    const date = new Date(Date.now() + index * 86_400_000);
    days.push({ value: parts.format(date), label: format.format(date) });
  }
  return days;
}

const orderSchema = z.object({
  address: z.string().trim().min(5, "Enter the full address."),
  condition: z.string().trim().min(3, "Describe the problem briefly."),
});

export function BookPage() {
  return (
    <PortalPage>
      <RequireRole role="PATIENT">{() => <BookForm />}</RequireRole>
    </PortalPage>
  );
}

function BookForm() {
  const id = useId();
  const router = useRouter();
  const params = useSearchParams();
  const physioId = params.get("physio") ?? undefined;
  const catalog = useCatalog();
  const physios = usePhysios({});
  const people = usePeople();
  const addPerson = useAddPerson();
  const create = useCreateBooking();

  const [serviceId, setServiceId] = useState(params.get("service") ?? "");
  const [packageId, setPackageId] = useState("");
  const [personId, setPersonId] = useState("");
  const [newPerson, setNewPerson] = useState({ name: "", gender: "FEMALE", birth_year: "", relation: "PARENT" });
  const [areaId, setAreaId] = useState("");
  const [address, setAddress] = useState("");
  const [condition, setCondition] = useState("");
  const [days] = useState(() => nextDays(14));
  const [day, setDay] = useState(days[0]?.value ?? "");
  const [slot, setSlot] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const slots = usePhysioSlots(physioId, day);

  const physio = physios.data?.find((item) => item.id === physioId);

  useEffect(() => {
    if (!physioId) router.replace("/find/");
  }, [physioId, router]);

  if (!physioId) return null;
  if (catalog.isPending || physios.isPending || people.isPending) {
    return (
      <div role="status" aria-label="Loading" className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!physio) {
    return <FormError message="This physiotherapist isn't available right now. Please choose another." />;
  }

  const services = (catalog.data?.services ?? []).filter(
    (item) => physio.service_type_ids.includes(item.id) && item.packages.length > 0,
  );
  const areas = (catalog.data?.areas ?? []).filter((item) => physio.area_ids.includes(item.id));
  const service = services.find((item) => item.id === serviceId);
  const chosenPackage = service?.packages.find((item) => item.id === packageId);
  const addingPerson = !personId;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string | undefined> = {};
    const parsed = orderSchema.safeParse({ address, condition });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      next.address = fields.address?.[0];
      next.condition = fields.condition?.[0];
    }
    if (!serviceId) next.service = "Choose a treatment.";
    if (!packageId) next.package = "Choose a session or package.";
    if (!areaId) next.area = "Choose your area.";
    if (!slot) next.slot = "Choose a time.";
    if (addingPerson && newPerson.name.trim().length < 2) next.person = "Enter the patient's name.";
    const year = Number(newPerson.birth_year);
    if (addingPerson && newPerson.birth_year && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())) {
      next.birth = "Enter a valid year, e.g. 1960.";
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    try {
      let patientId = personId;
      if (addingPerson) {
        const person = await addPerson.mutateAsync({
          name: newPerson.name.trim(),
          gender: newPerson.gender as "MALE" | "FEMALE",
          birth_year: newPerson.birth_year ? year : null,
          relation: newPerson.relation,
        });
        patientId = person.id;
        setPersonId(person.id);
      }
      await create.mutateAsync({
        patient_id: patientId,
        service_type_id: serviceId,
        package_id: packageId,
        provider_id: physio.id,
        address_line: address.trim(),
        area_id: areaId,
        start_at: slot,
        condition: condition.trim(),
      });
      router.push("/my/bookings/");
    } catch {
      // Shown from the mutation's error state below.
    }
  };

  return (
    <>
      <PageHeader title="Book a home visit" />
      <Card className="mt-4 flex items-center gap-3 p-4">
        <PhysioPhoto url={physio.photo_url} name={physio.name ?? "Physiotherapist"} size="size-12" />
        <div>
          <p className="font-semibold text-stone-900">{physio.name}</p>
          <p className="text-sm text-stone-600">
            {physio.qualification} · {physio.experience_years} years
          </p>
        </div>
      </Card>

      <form
        onSubmit={(event) => void onSubmit(event)}
        onChange={() => setErrors({})}
        noValidate
        className="mt-4 space-y-4"
      >
        <Card className="space-y-4 p-4">
          <h2 className="font-semibold text-stone-900">1. Treatment</h2>
          <FormField id={`${id}-service`} label="What do you need help with?" error={errors.service}>
            <select
              id={`${id}-service`}
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
                setPackageId("");
              }}
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
          {service ? (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-stone-700">Single session or package</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {service.packages.map((item) => (
                  <label
                    key={item.id}
                    className={cn(
                      "cursor-pointer rounded-lg p-3 ring-1 transition",
                      packageId === item.id ? "bg-brand-50 ring-2 ring-brand-600" : "ring-stone-200 hover:bg-stone-50",
                    )}
                  >
                    <input
                      type="radio"
                      name="package"
                      className="sr-only"
                      checked={packageId === item.id}
                      onChange={() => setPackageId(item.id)}
                    />
                    <span className="block text-sm font-semibold text-stone-900">
                      {item.sessions_count} {item.sessions_count === 1 ? "session" : "sessions"}
                    </span>
                    <span className="block text-sm text-stone-600">{formatPkr(item.price_pkr)}</span>
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
              placeholder="e.g. Knee replacement 3 weeks ago"
              aria-invalid={Boolean(errors.condition)}
              className={cn(adminInput, "h-auto py-2")}
            />
          </FormField>
        </Card>

        <Card className="space-y-4 p-4">
          <h2 className="font-semibold text-stone-900">2. Patient and address</h2>
          <FormField id={`${id}-person`} label="Who is this for?">
            <select
              id={`${id}-person`}
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
              className={adminInput}
            >
              <option value="">Someone new</option>
              {people.data?.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </FormField>
          {addingPerson ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id={`${id}-pname`} label="Patient's name" error={errors.person}>
                <input
                  id={`${id}-pname`}
                  value={newPerson.name}
                  onChange={(event) => setNewPerson((prev) => ({ ...prev, name: event.target.value }))}
                  aria-invalid={Boolean(errors.person)}
                  className={adminInput}
                />
              </FormField>
              <FormField id={`${id}-pyear`} label="Birth year (optional)" error={errors.birth}>
                <input
                  id={`${id}-pyear`}
                  inputMode="numeric"
                  value={newPerson.birth_year}
                  onChange={(event) => setNewPerson((prev) => ({ ...prev, birth_year: event.target.value }))}
                  aria-invalid={Boolean(errors.birth)}
                  className={adminInput}
                />
              </FormField>
              <FormField id={`${id}-pgender`} label="Patient's gender">
                <select
                  id={`${id}-pgender`}
                  value={newPerson.gender}
                  onChange={(event) => setNewPerson((prev) => ({ ...prev, gender: event.target.value }))}
                  className={adminInput}
                >
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                </select>
              </FormField>
              <FormField id={`${id}-prelation`} label="They are your">
                <select
                  id={`${id}-prelation`}
                  value={newPerson.relation}
                  onChange={(event) => setNewPerson((prev) => ({ ...prev, relation: event.target.value }))}
                  className={adminInput}
                >
                  <option value="SELF">It&apos;s me</option>
                  <option value="PARENT">Parent</option>
                  <option value="SPOUSE">Spouse</option>
                  <option value="CHILD">Child</option>
                  <option value="SIBLING">Sibling</option>
                  <option value="OTHER">Other</option>
                </select>
              </FormField>
            </div>
          ) : null}
          <FormField id={`${id}-area`} label="Area" error={errors.area}>
            <select
              id={`${id}-area`}
              value={areaId}
              onChange={(event) => setAreaId(event.target.value)}
              aria-invalid={Boolean(errors.area)}
              className={adminInput}
            >
              <option value="">Choose an area this physio covers</option>
              {areas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id={`${id}-address`} label="Full address" hint="Shared only after the physio accepts." error={errors.address}>
            <input
              id={`${id}-address`}
              autoComplete="street-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              aria-invalid={Boolean(errors.address)}
              className={adminInput}
            />
          </FormField>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="font-semibold text-stone-900">3. Date and time</h2>
          <FormField id={`${id}-day`} label="Date">
            <select
              id={`${id}-day`}
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
                setSlot("");
              }}
              className={adminInput}
            >
              {days.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </FormField>
          {slots.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : slots.data && slots.data.length > 0 ? (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-stone-700">Open times</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {slots.data.map((value) => (
                  <label
                    key={value}
                    className={cn(
                      "cursor-pointer rounded-lg py-2 text-center text-sm font-medium ring-1 transition",
                      slot === value ? "bg-brand-50 text-brand-900 ring-2 ring-brand-600" : "text-stone-700 ring-stone-200 hover:bg-stone-50",
                    )}
                  >
                    <input
                      type="radio"
                      name="slot"
                      className="sr-only"
                      checked={slot === value}
                      onChange={() => setSlot(value)}
                    />
                    {timeFormat.format(new Date(value))}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="text-sm text-stone-500">No open times on this day. Try another date.</p>
          )}
          {errors.slot ? <p className="text-xs font-medium text-red-600">{errors.slot}</p> : null}
        </Card>

        <Card className="p-4">
          {chosenPackage ? (
            <p className="flex items-center justify-between font-semibold text-stone-900">
              <span>Total, paid in cash to the physio</span>
              <span>{formatPkr(chosenPackage.price_pkr)}</span>
            </p>
          ) : null}
          <p className="mt-2 text-xs text-stone-500">
            You can cancel up to 2 hours before a session. Phone numbers are shared 2 hours before each session.
          </p>
          <div className="mt-3 space-y-3">
            <FormError
              message={
                addPerson.isError
                  ? errorMessage(addPerson.error)
                  : create.isError
                    ? errorMessage(create.error)
                    : null
              }
            />
            <button
              type="submit"
              disabled={create.isPending || addPerson.isPending}
              className={adminButton("primary", "h-11 w-full")}
            >
              {create.isPending ? "Placing order..." : "Place order"}
            </button>
          </div>
        </Card>
        <EmergencyLine />
      </form>
    </>
  );
}
