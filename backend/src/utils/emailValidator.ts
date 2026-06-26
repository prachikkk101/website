import emailValidator from 'deep-email-validator';

/**
 * Normalizes email address to lowercase
 */
export const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

/**
 * Validates the email against multiple checks.
 * Includes format, disposable, MX records, domain existence, and common fake addresses.
 */
export const validateEmailStrict = async (email: string) => {
  // Step 6: Normalize Email immediately for consistent checks
  const normalized = normalizeEmail(email);

  // Step 8: Hardcoded suspicious emails to reject
  const suspiciousPrefixes = ['aaaaaa', '123456', 'test', 'admin', 'fake'];
  const suspiciousDomains = ['test.com', 'admin.com', 'fake.com', 'example.com'];
  
  const [localPart, domainPart] = normalized.split('@');
  
  if (suspiciousPrefixes.includes(localPart) || suspiciousDomains.includes(domainPart)) {
    return {
      isValid: false,
      message: 'Please enter a real email address.',
    };
  }

  // Step 9: Use professional API or robust validation engine
  // Using deep-email-validator which handles format, disposable, MX, and SMTP checks.
  // It checks against disposable lists (Mailinator, GuerrillaMail, 10minutemail, etc.)
  const result = await emailValidator({
    email: normalized,
    validateRegex: true,
    validateMx: true,
    validateTypo: true,
    validateDisposable: true,
    validateSMTP: false, // SMTP check is often blocked by modern providers, so disabled as requested by "without sending OTP" but MX is enough for domain exist check.
  });

  if (!result.valid) {
    const reason = result.reason;
    if (reason === 'regex') {
      return { isValid: false, message: 'Invalid email format.' };
    }
    if (reason === 'disposable') {
      return { isValid: false, message: 'Disposable email addresses are not allowed.' };
    }
    if (reason === 'mx') {
      return { isValid: false, message: 'This email domain does not exist or cannot receive emails.' };
    }
    if (reason === 'typo') {
      return { isValid: false, message: 'Invalid email domain format or typo.' };
    }
    if (reason === 'smtp') {
      return { isValid: false, message: 'Mail server issue detected.' };
    }

    return { isValid: false, message: 'Please enter a real email address.' };
  }

  return {
    isValid: true,
    email: normalized,
  };
};
