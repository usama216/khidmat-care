"use client";

import { useEffect, useState } from "react";
import { Check, CircleDot, Phone, RotateCcw, Search } from "lucide-react";
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
  Modal,
  PageHeader,
  Pagination,
  TableSkeleton,
} from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { useMessages, useUpdateMessage, type ContactMessage, type MessageStatus } from "./api";

const FILTERS: { value: MessageStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "NEW", label: "New" },
  { value: "HANDLED", label: "Handled" },
];

function StatusBadge({ status }: { status: MessageStatus }) {
  return status === "NEW" ? (
    <Badge tone="attention" icon={CircleDot}>
      New
    </Badge>
  ) : (
    <Badge tone="good" icon={Check}>
      Handled
    </Badge>
  );
}

export function MessagesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<MessageStatus | undefined>("NEW");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const messages = useMessages({ page, status, search: search || undefined });
  const items = messages.data?.items ?? [];
  const open = items.find((item) => item.id === openId) ?? null;

  return (
    <>
      <PageHeader title="Messages" description="Sent through the contact form on the website." />

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 p-4">
          <div role="group" aria-label="Filter by status" className="flex gap-1 rounded-lg bg-stone-100 p-1">
            {FILTERS.map((filter) => (
              <button
                key={filter.label}
                type="button"
                aria-pressed={status === filter.value}
                onClick={() => {
                  setStatus(filter.value);
                  setPage(1);
                }}
                className={cn(
                  "h-7 rounded-md px-3 text-sm font-medium transition",
                  status === filter.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="relative ms-auto w-full sm:w-72">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search messages"
              placeholder="Search name, phone or message"
              maxLength={100}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className={cn(adminInput, "ps-9")}
            />
          </div>
        </div>

        {messages.isPending ? (
          <TableSkeleton />
        ) : messages.isError ? (
          <ErrorState onRetry={() => void messages.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title={search ? "No messages match your search" : status === "NEW" ? "You're all caught up" : "No messages yet"}
            description={search ? "Try a different name or number." : "New contact form messages will appear here."}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-start text-xs font-medium text-stone-500">
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">
                      From
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">
                      Message
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-end font-medium">
                      Received
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((item) => (
                    <tr key={item.id} className="transition hover:bg-stone-50">
                      <td className="px-5 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => setOpenId(item.id)}
                          className="text-start font-medium text-stone-900 hover:underline"
                        >
                          {item.name}
                        </button>
                        <p className="text-xs text-stone-500 tabular-nums">{item.phone}</p>
                      </td>
                      <td className="max-w-md px-5 py-3 align-top text-stone-600">
                        <p dir="auto" className="truncate">
                          {item.message}
                        </p>
                      </td>
                      <td className="px-5 py-3 align-top">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-5 py-3 text-end align-top text-xs whitespace-nowrap text-stone-500">
                        {formatDateTime(item.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={messages.data.page}
              pageSize={messages.data.page_size}
              total={messages.data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      {open ? <MessageDrawer message={open} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function MessageDrawer({ message, onClose }: { message: ContactMessage; onClose: () => void }) {
  const update = useUpdateMessage();
  const handled = message.status === "HANDLED";

  return (
    <Modal title={message.name} onClose={onClose} side>
      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={message.status} />
        <p className="text-xs text-stone-500">{formatDateTime(message.created_at)}</p>
      </div>
      <a href={`tel:${message.phone}`} className={adminButton("secondary", "mt-5 w-full")}>
        <Phone className="size-4" aria-hidden="true" />
        Call <span className="tabular-nums">{message.phone}</span>
      </a>
      <p dir="auto" className="mt-5 rounded-lg bg-stone-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-stone-800 ring-1 ring-stone-200">
        {message.message}
      </p>
      <div className="mt-5 space-y-3">
        <FormError message={update.isError ? errorMessage(update.error) : null} />
        <button
          type="button"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: message.id, status: handled ? "NEW" : "HANDLED" })}
          className={adminButton(handled ? "secondary" : "primary", "w-full")}
        >
          {handled ? <RotateCcw className="size-4" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
          {handled ? "Move back to new" : "Mark as handled"}
        </button>
      </div>
    </Modal>
  );
}
