import type {  User  } from "@toolshare/shared";

type Props = {
  users: User[];
  currentUserId?: string;
  onChange: (userId: string) => void;
};

export function RoleSwitcher({ users, currentUserId, onChange }: Props) {
  return (
    <label className="role-switcher">
      Aktiver Testnutzer:
      <select
        value={currentUserId}
        onChange={(e) => onChange(e.target.value)}
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.role})
          </option>
        ))}
      </select>
    </label>
  );
}
