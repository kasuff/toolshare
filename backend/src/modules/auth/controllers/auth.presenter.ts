import type {
  AuthResponse,
  AuthUserResponse,
  RefreshResponse
} from "@toolshare/shared/contracts/response/auth.schema";

export type AuthUserInput = {
  id: string;
  email: string;
  name: string;
  role: AuthUserResponse["role"];
  address?: string;
  isSuspended?: boolean;
};

export function toAuthUserResponse(user: AuthUserInput): AuthUserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    address: user.address,
    isSuspended: user.isSuspended
  };
}

export function toAuthResponse(input: {
  user: AuthUserInput;
  accessToken: string;
  refreshToken: string;
}): AuthResponse {
  return {
    user: toAuthUserResponse(input.user),
    accessToken: input.accessToken,
    refreshToken: input.refreshToken
  };
}

export function toRefreshResponse(input: {
  accessToken: string;
  refreshToken: string;
}): RefreshResponse {
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken
  };
}