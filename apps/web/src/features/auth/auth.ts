"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError, apiGet, apiPost } from "@/lib/api";

export type CurrentUser = {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  role: "PATIENT" | "PROVIDER" | "ADMIN" | "OPERATIONS" | "VERIFICATION" | "FINANCE" | "SUPPORT";
  permissions: string[];
  must_change_password: boolean;
};

export function isStaff(user: CurrentUser | null | undefined) {
  return Boolean(user?.permissions.includes("dashboard.view"));
}

/** Whether the signed-in user holds a permission. Only hides UI; the API enforces it. */
export function useCan() {
  const me = useCurrentUser();
  const permissions = me.data?.permissions ?? [];
  return (permission: string) => permissions.includes(permission);
}

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or phone number."),
  password: z.string().min(1, "Enter your password."),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters."),
    confirm: z.string(),
  })
  .refine((values) => values.next === values.confirm, {
    path: ["confirm"],
    message: "The passwords don't match.",
  })
  .refine((values) => values.next !== values.current, {
    path: ["next"],
    message: "Choose a different password from the current one.",
  });

const ME_KEY = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery<CurrentUser | null, ApiError>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await apiGet<CurrentUser>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<CurrentUser, ApiError, LoginValues>({
    mutationFn: (values) => apiPost<CurrentUser>("/auth/login", values),
    onSuccess: (user) => queryClient.setQueryData(ME_KEY, user),
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation<CurrentUser, ApiError, { current_password: string; new_password: string }>({
    mutationFn: (values) => apiPost<CurrentUser>("/auth/change-password", values),
    onSuccess: (user) => {
      queryClient.setQueryData(ME_KEY, user);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError>({
    mutationFn: () => apiPost<void>("/auth/logout"),
    // Clears every cached admin record, so nothing stays in memory after signing out.
    onSettled: () => queryClient.clear(),
  });
}
