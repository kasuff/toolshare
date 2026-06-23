import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { addressService } from "../address/address.service";
import { authRepository } from "./auth.repository";
import { toAuthResponse, toRefreshResponse } from "./auth.presenter";

const SALT_ROUNDS = 12;

type TokenPayload = {
  userId: string;
  role: "USER" | "MODERATOR" | "MANAGER";
};

const signAccessToken = (payload: TokenPayload) => {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"]
  });
};

const signRefreshToken = (payload: TokenPayload) => {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtRefreshExpiresIn as SignOptions["expiresIn"]
  });
};

const buildAuthPayload = (user: {
  id: string;
  email: string;
  role: TokenPayload["role"];
  name: string;
  address?: string;
  isSuspended?: boolean;
}) => {
  const payload: TokenPayload = { userId: user.id, role: user.role };
  return toAuthResponse({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      address: user.address,
      isSuspended: user.isSuspended
    },
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload)
  });
};

export const authService = {
  async register(input: {
    email: string;
    password: string;
    name: string;
    address: string;
  }) {
    const existing = await authRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError("EMAIL_ALREADY_EXISTS", "Email already registered", 409);
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const coordinates = await addressService.geocode(input.address);
    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
      address: input.address,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      role: "USER"
    });

    return buildAuthPayload(user);
  },

  async login(input: { email: string; password: string }) {
    const user = await authRepository.findByEmail(input.email);
    if (!user) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid credentials", 401);
    }

    if (user.isSuspended) {
      throw new AppError("ACCOUNT_SUSPENDED", "Konto ist gesperrt.", 403);
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid credentials", 401);
    }

    return buildAuthPayload(user);
  },

  async changePassword(input: { userId: string; currentPassword: string; newPassword: string }) {
    const user = await authRepository.findCredentialsById(input.userId);
    if (!user) {
      throw new AppError("UNAUTHORIZED", "User not found", 401);
    }

    const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AppError("INVALID_CURRENT_PASSWORD", "Aktuelles Passwort ist falsch.", 400);
    }

    if (input.currentPassword === input.newPassword) {
      throw new AppError(
        "PASSWORD_UNCHANGED",
        "Das neue Passwort muss sich vom aktuellen unterscheiden.",
        400
      );
    }

    const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
    await authRepository.updatePassword(input.userId, passwordHash);
  },

  async refresh(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, env.jwtSecret) as TokenPayload;
      const user = await authRepository.findById(payload.userId);
      if (!user) {
        throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
      }

      if (user.isSuspended) {
        throw new AppError("ACCOUNT_SUSPENDED", "Konto ist gesperrt.", 403);
      }

      return toRefreshResponse({
        accessToken: signAccessToken({ userId: payload.userId, role: user.role }),
        refreshToken: signRefreshToken({ userId: payload.userId, role: user.role })
      });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
    }
  }
};
