import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Verzeichnis für vorbereitete Sessions (gitignored). */
export const STORAGE_DIR = path.resolve(here, "..", ".auth");
export const usersFile = path.join(STORAGE_DIR, "users.json");

/** Bekannte Rollen-Labels, die das Setup vorbereitet. */
export type RoleLabel = "anfrager" | "anbieter" | "manager" | "moderator";

export function storageFileFor(label: RoleLabel): string {
  return path.join(STORAGE_DIR, `${label}.json`);
}

export type SeededUser = {
  label: string;
  email: string;
  password: string;
  name: string;
  address: string;
  id: string;
  token: string;
};

/** Liest die im Setup angelegten Nutzer (E-Mail, Passwort, Id, Token). */
export function readUsers(): Record<RoleLabel, SeededUser> {
  return JSON.parse(fs.readFileSync(usersFile, "utf-8"));
}
