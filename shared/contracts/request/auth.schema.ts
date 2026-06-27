import { z } from "zod";

const hasHouseNumber = (val: string) => {
  const streetPart = val.split(",")[0]?.trim() ?? "";
  const tokens = streetPart.split(/\s+/).filter(Boolean);
  const lastToken = tokens.length > 1 ? tokens.pop() : "";
  return Boolean(lastToken && /\d/.test(lastToken));
};

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  address: z.string().min(5).refine(hasHouseNumber, {
    message: "Die Adresse muss eine Hausnummer enthalten."
  })
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1).optional()
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
