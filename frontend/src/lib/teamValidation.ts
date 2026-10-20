const MAX_TEAM_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function teamNameError(name: string): string | null {
  const trimmed = name.trim();
  return trimmed.length === 0 || trimmed.length > MAX_TEAM_NAME_LENGTH
    ? `Il nome del team deve avere da 1 a ${MAX_TEAM_NAME_LENGTH} caratteri`
    : null;
}

export function memberEmailError(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  return normalized.length <= MAX_EMAIL_LENGTH && EMAIL.test(normalized) ? null : 'Email non valida';
}
