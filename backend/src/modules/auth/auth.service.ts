import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { addressService } from "../address/address.service";
import { authRepository } from "./auth.repository";

const SALT_ROUNDS = 12;

type TokenPayload = {
  userId: string;
  role: "USER" | "MODERATOR" | "MANAGER";
};

// Nur der Hash des Refresh-Tokens wird gespeichert – nie das Token selbst.
const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

const signAccessToken = (payload: TokenPayload) => {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"]
  });
};

const signRefreshToken = (payload: TokenPayload) => {
  // Eigenes Secret + eindeutige jti, damit jeder Refresh-Token einmalig ist
  // (sonst kollidieren zwei Tokens mit gleichem Payload in derselben Sekunde).
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn as SignOptions["expiresIn"],
    jwtid: randomUUID()
  });
};

// Stellt einen Refresh-Token aus und hinterlegt seinen Hash serverseitig.
const issueRefreshToken = async (payload: TokenPayload): Promise<string> => {
  const token = signRefreshToken(payload);
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await authRepository.createRefreshToken({ userId: payload.userId, tokenHash: hashToken(token), expiresAt });
  return token;
};

const buildAuthPayload = async (user: {
  id: string;
  email: string;
  role: TokenPayload["role"];
  name: string;
  address?: string;
  isSuspended?: boolean;
}) => {
  const payload: TokenPayload = { userId: user.id, role: user.role };
  const refreshToken = await issueRefreshToken(payload);
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      address: user.address,
      isSuspended: user.isSuspended
    },
    accessToken: signAccessToken(payload),
    refreshToken
  };
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
    // Passwortwechsel macht alle bestehenden Sitzungen ungültig.
    await authRepository.revokeAllRefreshTokensForUser(input.userId);
  },

  async refresh(refreshToken: string) {
    let payload: TokenPayload;
    try {
      payload = jwt.verify(refreshToken, env.jwtRefreshSecret) as TokenPayload;
    } catch {
      throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
    }

    // Serverseitige Prüfung: Token muss bekannt, nicht widerrufen und nicht abgelaufen sein.
    const tokenHash = hashToken(refreshToken);
    const stored = await authRepository.findRefreshToken(tokenHash);
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      // Wiederverwendung eines bereits rotierten/widerrufenen Tokens deutet auf
      // Diebstahl hin → vorsichtshalber alle Sitzungen des Nutzers beenden.
      if (stored?.userId) {
        await authRepository.revokeAllRefreshTokensForUser(stored.userId);
      }
      throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
    }

    const user = await authRepository.findById(payload.userId);
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
    }
    if (user.isSuspended) {
      throw new AppError("ACCOUNT_SUSPENDED", "Konto ist gesperrt.", 403);
    }

    // Rotation: alten Token entwerten, neuen ausstellen und speichern.
    await authRepository.revokeRefreshToken(tokenHash);
    const nextPayload: TokenPayload = { userId: payload.userId, role: user.role };
    const nextRefreshToken = await issueRefreshToken(nextPayload);
    return {
      accessToken: signAccessToken(nextPayload),
      refreshToken: nextRefreshToken
    };
  },

  // Logout ist idempotent: der vorgelegte Refresh-Token wird serverseitig
  // entwertet, sodass er nicht mehr eingelöst werden kann.
  async logout(refreshToken: string) {
    if (!refreshToken) {
      return;
    }
    await authRepository.revokeRefreshToken(hashToken(refreshToken));
  }
};
