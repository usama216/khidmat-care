"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError, apiGet, apiPost } from "@/lib/api";

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: "PATIENT" | "PROVIDER" | "ADMIN";
};

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
export type LoginValues = z.infer<typeof loginSchema>;

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

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError>({
    mutationFn: () => apiPost<void>("/auth/logout"),
    // Clears every cached admin record, so nothing stays in memory after signing out.
    onSettled: () => queryClient.clear(),
  });
}
