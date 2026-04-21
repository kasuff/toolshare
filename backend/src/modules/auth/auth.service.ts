import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { authRepository } from "./auth.repository";

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

export const authService = {
  async register(input: {
    email: string;
    password: string;
    name: string;
    address: string;
    role?: "USER" | "MODERATOR" | "MANAGER";
  }) {
    const existing = await authRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError("EMAIL_ALREADY_EXISTS", "Email already registered", 409);
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
      address: input.address,
      role: input.role ?? "USER"
    });

    const payload: TokenPayload = { userId: user.id, role: user.role };
    return {
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload)
    };
  },

  async login(input: { email: string; password: string }) {
    const user = await authRepository.findByEmail(input.email);
    if (!user) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid credentials", 401);
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid credentials", 401);
    }

    const payload: TokenPayload = { userId: user.id, role: user.role };
    return {
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload)
    };
  },

  refresh(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, env.jwtSecret) as TokenPayload;
      return {
        accessToken: signAccessToken({ userId: payload.userId, role: payload.role }),
        refreshToken: signRefreshToken({ userId: payload.userId, role: payload.role })
      };
    } catch {
      throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
    }
  }
};
