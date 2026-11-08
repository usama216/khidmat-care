"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, CircleOff, Plus } from "lucide-react";
import {
  adminButton,
  adminInput,
  Badge,
  Card,
  EmptyState,
  errorMessage,
  ErrorState,
  FormError,
  FormField,
  Modal,
  PageHeader,
  TableSkeleton,
} from "@/components/admin/ui";
import { formatPkr } from "@/lib/format";
import {
  packageSchema,
  priceSchema,
  serviceSchema,
  useCreatePackage,
  useCreateService,
  useServices,
  useUpdatePackage,
  useUpdateService,
  type Package,
  type Service,
} from "./api";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CatalogPage() {
  const services = useServices();
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<Service | null>(null);
  const [editing, setEditing] = useState<Package | null>(null);

  return (
    <>
      <PageHeader
        title="Services & pricing"
        description="New prices apply to new bookings. Existing bookings keep the price they were made with."
        actions={
          <button type="button" onClick={() => setCreating(true)} className={adminButton("primary")}>
            <Plus className="size-4" aria-hidden="true" />
            Add service
          </button>
        }
      />

      {services.isPending ? (
        <Card className="mt-6">
          <TableSkeleton />
        </Card>
      ) : services.isError ? (
        <Card className="mt-6">
          <ErrorState onRetry={() => void services.refetch()} />
        </Card>
      ) : services.data.length === 0 ? (
        <Card className="mt-6">
          <EmptyState title="No services yet" description="Add your first service to start setting prices." />
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {services.data.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onAddPackage={() => setAddingTo(service)}
              onEditPackage={setEditing}
            />
          ))}
        </div>
      )}

      {creating ? <ServiceForm onClose={() => setCreating(false)} /> : null}
      {addingTo ? <PackageForm service={addingTo} onClose={() => setAddingTo(null)} /> : null}
      {editing ? <PriceForm pkg={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function ServiceCard({
  service,
  onAddPackage,
  onEditPackage,
}: {
  service: Service;
  onAddPackage: () => void;
  onEditPackage: (pkg: Package) => void;
}) {
  const update = useUpdateService();
  const activePackages = service.packages.filter((pkg) => pkg.is_active);
  const retired = service.packages.length - activePackages.length;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-stone-900">{service.name}</h2>
            {service.is_active ? (
              <Badge tone="good" icon={Check}>
                Active
              </Badge>
            ) : (
              <Badge icon={CircleOff}>Hidden</Badge>
            )}
          </div>
          <p lang="ur" dir="rtl" className="mt-1 text-end font-urdu text-sm text-stone-500">
            {service.name_urdu}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={update.isPending}
            onClick={() => update.mutate({ id: service.id, is_active: !service.is_active })}
            className={adminButton("ghost")}
          >
            {service.is_active ? "Hide" : "Show"}
          </button>
          <button type="button" onClick={onAddPackage} className={adminButton("secondary")}>
            <Plus className="size-4" aria-hidden="true" />
            Add package
          </button>
        </div>
      </div>
      {update.isError ? (
        <div className="px-4 pt-4">
          <FormError message={errorMessage(update.error)} />
        </div>
      ) : null}
      {activePackages.length === 0 ? (
        <p className="p-4 text-sm text-stone-500">No active packages. Add one to set a price.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {activePackages.map((pkg) => (
            <li key={pkg.id}>
              <button
                type="button"
                onClick={() => onEditPackage(pkg)}
                aria-label={`Edit ${pkg.sessions_count} session package`}
                className="block w-full rounded-lg p-3 text-start ring-1 ring-stone-200 transition hover:bg-stone-50 hover:ring-stone-300"
              >
                <p className="text-xs text-stone-500">
                  {pkg.sessions_count} {pkg.sessions_count === 1 ? "session" : "sessions"}
                </p>
                <p className="mt-0.5 font-semibold text-stone-900 tabular-nums">{formatPkr(pkg.price_pkr)}</p>
                {pkg.sessions_count > 1 ? (
                  <p className="text-xs text-stone-500 tabular-nums">
                    {formatPkr(pkg.price_pkr / pkg.sessions_count)} per session
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {retired > 0 ? <p className="px-4 pb-4 text-xs text-stone-500">{retired} retired package(s) hidden.</p> : null}
    </Card>
  );
}

function ServiceForm({ onClose }: { onClose: () => void }) {
  const id = useId();
  const create = useCreateService();
  const [name, setName] = useState("");
  const [nameUrdu, setNameUrdu] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"name" | "name_urdu" | "slug", string>>>({});

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = serviceSchema.safeParse({ name, name_urdu: nameUrdu, slug });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({ name: fields.name?.[0], name_urdu: fields.name_urdu?.[0], slug: fields.slug?.[0] });
      return;
    }
    setErrors({});
    create.mutate(parsed.data, { onSuccess: onClose });
  };

  return (
    <Modal title="Add service" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id={`${id}-name`} label="Name (English)" error={errors.name}>
          <input
            id={`${id}-name`}
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugEdited) setSlug(slugify(event.target.value));
            }}
            aria-invalid={Boolean(errors.name)}
            className={adminInput}
          />
        </FormField>
        <FormField id={`${id}-urdu`} label="Name (Urdu)" error={errors.name_urdu}>
          <input
            id={`${id}-urdu`}
            lang="ur"
            dir="rtl"
            value={nameUrdu}
            onChange={(event) => setNameUrdu(event.target.value)}
            aria-invalid={Boolean(errors.name_urdu)}
            className={adminInput}
          />
        </FormField>
        <FormField id={`${id}-slug`} label="Slug" hint="Used in web addresses. It can't be changed later." error={errors.slug}>
          <input
            id={`${id}-slug`}
            value={slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value);
            }}
            aria-invalid={Boolean(errors.slug)}
            className={adminInput}
          />
        </FormField>
        <FormError message={create.isError ? errorMessage(create.error) : null} />
        <FormActions pending={create.isPending} submit="Add service" onCancel={onClose} />
      </form>
    </Modal>
  );
}

function PackageForm({ service, onClose }: { service: Service; onClose: () => void }) {
  const id = useId();
  const create = useCreatePackage();
  const [sessions, setSessions] = useState("");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"sessions_count" | "price_pkr", string>>>({});

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = packageSchema.safeParse({ sessions_count: sessions, price_pkr: price });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({ sessions_count: fields.sessions_count?.[0], price_pkr: fields.price_pkr?.[0] });
      return;
    }
    setErrors({});
    create.mutate({ serviceId: service.id, ...parsed.data }, { onSuccess: onClose });
  };

  return (
    <Modal title={`Add package: ${service.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id={`${id}-sessions`} label="Number of sessions" error={errors.sessions_count}>
          <input
            id={`${id}-sessions`}
            inputMode="numeric"
            autoFocus
            value={sessions}
            onChange={(event) => setSessions(event.target.value)}
            aria-invalid={Boolean(errors.sessions_count)}
            className={adminInput}
          />
        </FormField>
        <FormField id={`${id}-price`} label="Total price (PKR)" error={errors.price_pkr}>
          <input
            id={`${id}-price`}
            inputMode="numeric"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            aria-invalid={Boolean(errors.price_pkr)}
            className={adminInput}
          />
        </FormField>
        <FormError message={create.isError ? errorMessage(create.error) : null} />
        <FormActions pending={create.isPending} submit="Add package" onCancel={onClose} />
      </form>
    </Modal>
  );
}

function PriceForm({ pkg, onClose }: { pkg: Package; onClose: () => void }) {
  const id = useId();
  const update = useUpdatePackage();
  const [price, setPrice] = useState(String(pkg.price_pkr));
  const [error, setError] = useState<string>();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = priceSchema.safeParse(price);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    update.mutate({ id: pkg.id, price_pkr: parsed.data }, { onSuccess: onClose });
  };

  return (
    <Modal title={`${pkg.sessions_count} session package`} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id={id} label="Total price (PKR)" error={error}>
          <input
            id={id}
            inputMode="numeric"
            autoFocus
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            aria-invalid={Boolean(error)}
            className={adminInput}
          />
        </FormField>
        <FormError message={update.isError ? errorMessage(update.error) : null} />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={update.isPending}
            onClick={() => update.mutate({ id: pkg.id, is_active: false }, { onSuccess: onClose })}
            className={adminButton("ghost", "text-red-700 hover:bg-red-50 hover:text-red-800")}
          >
            Retire package
          </button>
          <FormActions pending={update.isPending} submit="Save price" onCancel={onClose} />
        </div>
      </form>
    </Modal>
  );
}

function FormActions({ pending, submit, onCancel }: { pending: boolean; submit: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onCancel} className={adminButton("secondary")}>
        Cancel
      </button>
      <button type="submit" disabled={pending} className={adminButton("primary")}>
        {pending ? "Saving..." : submit}
      </button>
    </div>
  );
}
