import { z } from "zod";

const hasHouseNumber = (val: string) => {
  const streetPart = val.split(",")[0]?.trim() ?? "";
  const tokens = streetPart.split(/\s+/).filter(Boolean);
  const lastToken = tokens.length > 1 ? tokens.pop() : "";
  return Boolean(lastToken && /\d/.test(lastToken));
};

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    address: z.string().min(5).refine(hasHouseNumber, {
      message: "Die Adresse muss eine Hausnummer enthalten."
    })
  }),
  params: z.object({}),
  query: z.object({})
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  }),
  params: z.object({}),
  query: z.object({})
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1)
  }),
  params: z.object({}),
  query: z.object({})
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8)
  }),
  params: z.object({}),
  query: z.object({})
});
