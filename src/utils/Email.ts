/**
 * Validates email address format.
 * @description Checks local part domain labels and basic syntax.
 * @param email - Email address string to validate
 * @throws {Error} When email validation fails
 */
export function isValidEmail(email: string): void {
  if (!email) {
    throw new Error('Email is required')
  }
  if (email.length > 254) {
    throw new Error('Email is too long (max 254 characters)')
  }
  const parts = email.split('@')
  if (parts.length !== 2) {
    throw new Error('Email must contain exactly one @ symbol')
  }
  const [local, domain] = parts
  if (!local) {
    throw new Error('Email local part cannot be empty')
  }
  if (local.length > 64) {
    throw new Error('Email local part is too long (max 64 characters)')
  }
  if (local.startsWith('.') || local.endsWith('.')) {
    throw new Error('Email local part cannot start or end with a dot')
  }
  if (local.includes('..')) {
    throw new Error('Email local part cannot contain consecutive dots')
  }
  if (!domain) {
    throw new Error('Email domain cannot be empty')
  }
  if (domain.length > 253) {
    throw new Error('Email domain is too long (max 253 characters)')
  }
  if (domain.startsWith('.') || domain.endsWith('.')) {
    throw new Error('Email domain cannot start or end with a dot')
  }
  if (domain.includes('..')) {
    throw new Error('Email domain cannot contain consecutive dots')
  }
  if (!domain.includes('.')) {
    throw new Error('Email domain must contain at least one dot')
  }
  const labels = domain.split('.')
  for (const label of labels) {
    if (label.length === 0) {
      throw new Error('Email domain labels cannot be empty')
    }
    if (label.length > 63) {
      throw new Error('Email domain labels cannot exceed 63 characters')
    }
    if (label.startsWith('-') || label.endsWith('-')) {
      throw new Error('Email domain labels cannot start or end with a hyphen')
    }
    if (label.includes('--')) {
      throw new Error('Email domain labels cannot contain consecutive hyphens')
    }
  }
}
