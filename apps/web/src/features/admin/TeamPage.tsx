"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, CircleOff, Copy, KeyRound, Plus, TriangleAlert } from "lucide-react";
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
  Pagination,
  TableSkeleton,
} from "@/components/admin/ui";
import { useCurrentUser } from "@/features/auth/auth";
import {
  STAFF_ROLES,
  staffSchema,
  useCreateStaff,
  useResetStaffPassword,
  useStaff,
  useUpdateStaff,
  type StaffMember,
  type StaffRole,
} from "./api";

const ROLE_HELP: Record<StaffRole, string> = {
  ADMIN: "Full access, including team and audit log.",
  OPERATIONS: "Orders, complaints, messages, services and pricing.",
  VERIFICATION: "Physiotherapist applications and documents.",
  FINANCE: "Balances, top-ups and settings.",
  SUPPORT: "Orders, complaints and messages.",
};

const ROLE_LABEL: Record<StaffRole, string> = {
  ADMIN: "Admin",
  OPERATIONS: "Operations",
  VERIFICATION: "Verification",
  FINANCE: "Finance",
  SUPPORT: "Support",
};

export function TeamPage() {
  const [page, setPage] = useState(1);
  const staff = useStaff(page);
  const me = useCurrentUser();
  const [adding, setAdding] = useState(false);
  const [credentials, setCredentials] = useState<{ name: string; password: string } | null>(null);

  return (
    <>
      <PageHeader
        title="Team"
        description="Staff accounts and what each person can access."
        actions={
          <button type="button" onClick={() => setAdding(true)} className={adminButton("primary")}>
            <Plus className="size-4" aria-hidden="true" />
            Add staff
          </button>
        }
      />
      <Card className="mt-6">
        {staff.isPending ? (
          <TableSkeleton rows={3} />
        ) : staff.isError ? (
          <ErrorState onRetry={() => void staff.refetch()} />
        ) : staff.data.items.length === 0 ? (
          <EmptyState title="No staff yet" />
        ) : (
          <>
            <ul className="divide-y divide-stone-100">
              {staff.data.items.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isSelf={member.id === me.data?.id}
                  onPasswordIssued={setCredentials}
                />
              ))}
            </ul>
            <Pagination
              page={staff.data.page}
              pageSize={staff.data.page_size}
              total={staff.data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      {adding ? (
        <StaffForm
          onClose={() => setAdding(false)}
          onCreated={(name, password) => {
            setAdding(false);
            setCredentials({ name, password });
          }}
        />
      ) : null}
      {credentials ? <CredentialsDialog {...credentials} onClose={() => setCredentials(null)} /> : null}
    </>
  );
}

function MemberRow({
  member,
  isSelf,
  onPasswordIssued,
}: {
  member: StaffMember;
  isSelf: boolean;
  onPasswordIssued: (value: { name: string; password: string }) => void;
}) {
  const id = useId();
  const update = useUpdateStaff();
  const reset = useResetStaffPassword();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const name = member.name ?? member.phone;
  const failure = update.error ?? reset.error;

  return (
    <li className="p-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-48 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium text-stone-900">
            {name}
            {isSelf ? <Badge>You</Badge> : null}
            {!member.is_active ? <Badge icon={CircleOff}>Deactivated</Badge> : null}
            {member.is_active && member.must_change_password ? (
              <Badge tone="attention" icon={KeyRound}>
                Password not set
              </Badge>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            {member.email} · <span className="tabular-nums">{member.phone}</span>
          </p>
        </div>
        <div className="w-40">
          <label htmlFor={`${id}-role`} className="sr-only">
            Role for {name}
          </label>
          <select
            id={`${id}-role`}
            value={member.role}
            disabled={isSelf || update.isPending}
            onChange={(event) => update.mutate({ id: member.id, role: event.target.value as StaffRole })}
            className={adminInput}
          >
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>
        {isSelf ? null : (
          <div className="flex gap-1">
            <button
              type="button"
              disabled={reset.isPending}
              onClick={() => setConfirmingReset(true)}
              className={adminButton("ghost")}
            >
              Reset password
            </button>
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: member.id, is_active: !member.is_active })}
              className={adminButton("ghost")}
            >
              {member.is_active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        )}
      </div>
      {failure ? (
        <div className="mt-3">
          <FormError message={errorMessage(failure)} />
        </div>
      ) : null}
      {confirmingReset ? (
        <Modal title={`Reset password for ${name}?`} onClose={() => setConfirmingReset(false)}>
          <p className="text-sm text-stone-600">
            Their current password stops working and they&apos;re signed out everywhere. You&apos;ll get a temporary
            password to give them.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmingReset(false)} className={adminButton("secondary")}>
              Cancel
            </button>
            <button
              type="button"
              disabled={reset.isPending}
              onClick={() =>
                reset.mutate(member.id, {
                  onSuccess: (result) => {
                    setConfirmingReset(false);
                    onPasswordIssued({ name, password: result.temporary_password });
                  },
                })
              }
              className={adminButton("primary")}
            >
              Reset password
            </button>
          </div>
        </Modal>
      ) : null}
    </li>
  );
}

function StaffForm({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string, password: string) => void }) {
  const id = useId();
  const create = useCreateStaff();
  const [values, setValues] = useState({ name: "", phone: "", email: "", role: "SUPPORT" as StaffRole });
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone" | "email", string>>>({});

  const set = (key: keyof typeof values, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = staffSchema.safeParse(values);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({ name: fields.name?.[0], phone: fields.phone?.[0], email: fields.email?.[0] });
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: (result) => onCreated(result.staff.name ?? result.staff.phone, result.temporary_password),
    });
  };

  return (
    <Modal title="Add staff" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id={`${id}-name`} label="Full name" error={errors.name}>
          <input
            id={`${id}-name`}
            autoFocus
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            aria-invalid={Boolean(errors.name)}
            className={adminInput}
          />
        </FormField>
        <FormField id={`${id}-phone`} label="Phone" error={errors.phone}>
          <input
            id={`${id}-phone`}
            type="tel"
            value={values.phone}
            onChange={(event) => set("phone", event.target.value)}
            placeholder="0300 1234567"
            aria-invalid={Boolean(errors.phone)}
            className={adminInput}
          />
        </FormField>
        <FormField id={`${id}-email`} label="Email" error={errors.email}>
          <input
            id={`${id}-email`}
            type="email"
            value={values.email}
            onChange={(event) => set("email", event.target.value)}
            aria-invalid={Boolean(errors.email)}
            className={adminInput}
          />
        </FormField>
        <FormField id={`${id}-role`} label="Role" hint={ROLE_HELP[values.role]}>
          <select
            id={`${id}-role`}
            value={values.role}
            onChange={(event) => set("role", event.target.value)}
            className={adminInput}
          >
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </FormField>
        <FormError message={create.isError ? errorMessage(create.error) : null} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={adminButton("secondary")}>
            Cancel
          </button>
          <button type="submit" disabled={create.isPending} className={adminButton("primary")}>
            {create.isPending ? "Adding..." : "Add staff"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CredentialsDialog({ name, password, onClose }: { name: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
  };

  return (
    <Modal title={`Temporary password for ${name}`} onClose={onClose}>
      <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Copy it now. It won&apos;t be shown again. They&apos;ll choose their own password when they first sign in.
      </p>
      <p className="mt-4 rounded-lg bg-stone-50 p-3 font-mono text-sm break-all text-stone-900 ring-1 ring-stone-200">
        {password}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={() => void copy()} className={adminButton("secondary")}>
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={onClose} className={adminButton("primary")}>
          Done
        </button>
      </div>
    </Modal>
  );
}
