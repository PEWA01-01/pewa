// Phone Normalization & Zambia Network Detection Service

export const SUPER_ADMIN_PIN = 'ipeze357';

export const ZAMBIA_NETWORKS = {
  Airtel: ['097', '077', '057', '97', '77', '57'],
  MTN: ['096', '076', '96', '76'],
  Zamtel: ['095', '95'],
  ZedMobile: ['098', '08', '98', '8']
};

/**
 * Extracts pure digits from input string.
 */
export function extractDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Determines if input is an email address or a phone number.
 */
export function isEmailInput(input: string): boolean {
  return input.includes('@') && input.includes('.');
}

/**
 * Normalizes phone number to standard international digit format (e.g. 260971234567).
 * Handles inputs like 0971234567, 971234567, 260971234567, +260971234567.
 */
export function normalizePhone(raw: string): string {
  let digits = extractDigits(raw);

  // If starts with 0 (e.g., 0971234567 -> 9 digits after 0)
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '260' + digits.substring(1);
  } else if (!digits.startsWith('260') && digits.length === 9) {
    // 971234567 -> 260971234567
    digits = '260' + digits;
  }

  return digits;
}

/**
 * Returns all common variations of a phone number to guarantee matching in database queries.
 * E.g., for +260971234567 -> ['+260971234567', '260971234567', '0971234567', '971234567']
 */
export function getPhoneVariations(raw: string): string[] {
  if (isEmailInput(raw)) {
    return [raw.trim().toLowerCase()];
  }

  const digits = extractDigits(raw);
  const canonical = normalizePhone(raw);
  const variations = new Set<string>();

  variations.add(raw.trim());
  variations.add(digits);
  variations.add(canonical);
  variations.add('+' + canonical);

  if (canonical.startsWith('260') && canonical.length === 12) {
    const localNine = canonical.substring(3); // 971234567
    const localTen = '0' + localNine; // 0971234567
    variations.add(localNine);
    variations.add(localTen);
  }

  return Array.from(variations);
}

/**
 * Detects Zambia network provider based on phone number prefix.
 */
export function detectZambiaNetwork(raw: string): string {
  const digits = extractDigits(raw);
  let prefix = digits;
  if (digits.startsWith('260')) prefix = digits.substring(3);
  if (prefix.startsWith('0')) prefix = prefix.substring(1);

  for (let [network, prefixes] of Object.entries(ZAMBIA_NETWORKS)) {
    for (let p of prefixes) {
      if (prefix.startsWith(p)) {
        return network;
      }
    }
  }

  return 'Unknown Network';
}

/**
 * Checks if input belongs to Super Admin (only mikelbishonga@gmail.com).
 */
export function isSuperAdminPhone(raw: string): boolean {
  if (!raw) return false;
  if (isEmailInput(raw)) {
    const email = raw.trim().toLowerCase();
    return email === 'mikelbishonga@gmail.com';
  }
  return false;
}

/**
 * Helper to calculate age from date string (YYYY-MM-DD).
 */
export function calculateAge(dobString: string): number {
  if (!dobString) return 0;
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
