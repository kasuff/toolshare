import { useMutation } from "@tanstack/react-query";
import { api } from "@toolshare/shared";

type CreateReportInput = {
  targetType: "RATING" | "TOOL" | "WORKSHOP" | "USER";
  targetId: string;
  reason: string;
  details?: string;
};

export function useCreateReport(token: string) {
  return useMutation({
    mutationFn: (input: CreateReportInput) => api.createReport(input, token)
  });
}
