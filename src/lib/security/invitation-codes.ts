import "server-only";
import { createHmac, randomInt } from "node:crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeInvitationCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatInvitationCode(value: string) {
  const normalized = normalizeInvitationCode(value);
  return normalized.length === 8 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : value.trim().toUpperCase();
}

export function createInvitationCode() {
  return formatInvitationCode(Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join(""));
}

export function hashInvitationCode(value: string) {
  const pepper = process.env.INVITATION_CODE_PEPPER;
  const normalized = normalizeInvitationCode(value);
  if (!pepper || normalized.length !== 8) return null;
  return createHmac("sha256", pepper).update(normalized).digest("hex");
}
