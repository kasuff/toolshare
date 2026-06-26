export type RoleValue = "USER" | "MODERATOR" | "MANAGER";

export type UserEntity = {
  id: string;
  email: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  role: RoleValue;
  isSuspended: boolean;
  expoPushToken?: string | null;
  createdAt?: Date;
};

export type AdminMetricsEntity = {
  users: number;
  tools: number;
  workshops: number;
  openBookings: number;
  openReports: number;
  openSuspensionRequests: number;
};
