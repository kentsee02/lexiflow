const COMMON_WEAK_PASSWORDS = new Set([
  'password123',
  'password1234',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyui',
  'admin123',
  'admin1234',
  'welcome1',
  'welcome123',
  'letmein1',
  'abc12345',
  'passw0rd',
  'lexiflow123',
  'iloveyou1',
  'test1234',
]);

export interface PasswordValidationResult {
  valid: boolean;
  reason?: string;
}

export function validatePasswordStrength(password: string, email?: string): PasswordValidationResult {
  if (password.length < 8 || password.length > 128) {
    return { valid: false, reason: 'Password must be between 8 and 128 characters.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must include at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'Password must include at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must include at least one number.' };
  }

  const lower = password.toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(lower)) {
    return { valid: false, reason: 'This password is too common. Please choose a stronger one.' };
  }

  if (email) {
    const localPart = email.split('@')[0]?.trim().toLowerCase();
    if (localPart && localPart.length >= 4 && lower.includes(localPart)) {
      return { valid: false, reason: 'Password should not contain your email username.' };
    }
  }

  return { valid: true };
}
