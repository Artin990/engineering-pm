export const ADMIN_EMAILS = [
  "amiriartin185@gmil.com",
  "amiriartin185@gmail.com",
  "artinamiri185@gmail.com",
];

export function isUserAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.some((adm) => adm.toLowerCase() === email.trim().toLowerCase());
}
