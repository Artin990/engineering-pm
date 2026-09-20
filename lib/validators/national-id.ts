/**
 * Iranian National ID (کد ملی ۱۰ رقمی) Validator
 * Follows the official mathematical checksum algorithm.
 */
export function isValidIranianNationalId(code: string | null | undefined): boolean {
  if (!code) return false;

  // Clean string and convert Persian/Arabic digits to English digits
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

  let clean = code
    .trim()
    .replace(/[۰-۹]/g, (w) => String(persianDigits.indexOf(w)))
    .replace(/[٠-٩]/g, (w) => String(arabicDigits.indexOf(w)))
    .replace(/[^0-9]/g, "");

  // Pad with leading zeros if between 8 and 10 digits
  if (clean.length >= 8 && clean.length < 10) {
    clean = clean.padStart(10, "0");
  }

  if (clean.length !== 10) {
    return false;
  }

  // Reject repeating digits (e.g. 0000000000, 1111111111, ...)
  const allIdentical = /^(\d)\1{9}$/.test(clean);
  if (allIdentical) {
    return false;
  }

  const check = parseInt(clean[9], 10);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i], 10) * (10 - i);
  }

  const remainder = sum % 11;
  return (remainder < 2 && check === remainder) || (remainder >= 2 && check === 11 - remainder);
}

/**
 * Format National ID with dash for display: 123-456789-0
 */
export function formatNationalId(code: string): string {
  const clean = code.replace(/\D/g, "").padStart(10, "0");
  if (clean.length !== 10) return code;
  return `${clean.slice(0, 3)}-${clean.slice(3, 9)}-${clean.slice(9)}`;
}
