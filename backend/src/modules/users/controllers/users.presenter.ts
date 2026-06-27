import type {
  AdminMetricsResponse,
  UserResponse
} from "@toolshare/shared/contracts/response/users.schema";
import type { AdminMetricsEntity, UserEntity } from "../entities/users.entity";

export function toUserResponse(user: UserEntity): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    address: user.address,
    latitude: user.latitude ?? null,
    longitude: user.longitude ?? null,
    role: user.role,
    isSuspended: user.isSuspended,
    expoPushToken: user.expoPushToken ?? null,
    createdAt:
      user.createdAt == null
        ? undefined
        : user.createdAt instanceof Date
          ? user.createdAt.toISOString()
          : String(user.createdAt)
  };
}

export function toUserResponseList(users: UserEntity[]): UserResponse[] {
  return users.map(toUserResponse);
}

export function toAdminMetricsResponse(metrics: AdminMetricsEntity): AdminMetricsResponse {
  return {
    users: metrics.users,
    tools: metrics.tools,
    workshops: metrics.workshops,
    openBookings: metrics.openBookings,
    openReports: metrics.openReports,
    openSuspensionRequests: metrics.openSuspensionRequests
  };
}