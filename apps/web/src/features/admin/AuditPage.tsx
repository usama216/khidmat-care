"use client";

import { useState } from "react";
import {
  Card,
  EmptyState,
  ErrorState,
  formatDateTime,
  PageHeader,
  Pagination,
  TableSkeleton,
} from "@/components/admin/ui";
import { useAuditLogs } from "./api";

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in",
  "admin.created_from_cli": "Admin account set up",
  "contact_message.status_changed": "Message status changed",
  "service.created": "Service added",
  "service.updated": "Service updated",
  "package.created": "Package added",
  "package.updated": "Package updated",
  "commission.updated": "Commission changed",
};

export function AuditPage() {
  const [page, setPage] = useState(1);
  const logs = useAuditLogs(page);

  return (
    <>
      <PageHeader title="Audit log" description="A permanent record of sign-ins and admin changes." />
      <Card className="mt-6">
        {logs.isPending ? (
          <TableSkeleton />
        ) : logs.isError ? (
          <ErrorState onRetry={() => void logs.refetch()} />
        ) : logs.data.items.length === 0 ? (
          <EmptyState title="Nothing recorded yet" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">
                      Action
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">
                      Details
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">
                      IP address
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-end font-medium">
                      When
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {logs.data.items.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-5 py-3 font-medium text-stone-900">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </td>
                      <td className="max-w-xs truncate px-5 py-3 text-xs text-stone-500">
                        {entry.metadata
                          ? Object.entries(entry.metadata)
                              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                              .join(", ")
                          : "-"}
                      </td>
                      <td className="px-5 py-3 text-xs text-stone-500 tabular-nums">{entry.ip_address ?? "-"}</td>
                      <td className="px-5 py-3 text-end text-xs whitespace-nowrap text-stone-500">
                        {formatDateTime(entry.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={logs.data.page}
              pageSize={logs.data.page_size}
              total={logs.data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}
