/**
 * Validate single mailbox address string.
 * @description Enforces one @, line-break ban, dot and label rules.
 * @param mailboxAddress - Raw address string to validate
 * @throws {Error} When syntax or length constraints fail
 */
export function validateMailboxAddress(mailboxAddress: string): void {
  if (!mailboxAddress) {
    throw new Error('Email is required')
  }
  if (mailboxAddress.length > 254) {
    throw new Error('Email is too long (max 254 characters)')
  }
  if (mailboxAddress.includes('\r') || mailboxAddress.includes('\n')) {
    throw new Error('Email cannot contain line break characters')
  }
  const localPartAndDomainParts = mailboxAddress.split('@')
  if (localPartAndDomainParts.length !== 2) {
    throw new Error('Email must contain exactly one @ symbol')
  }
  const [localPart, domainPart] = localPartAndDomainParts
  if (!localPart) {
    throw new Error('Email local part cannot be empty')
  }
  if (localPart.length > 64) {
    throw new Error('Email local part is too long (max 64 characters)')
  }
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    throw new Error('Email local part cannot start or end with a dot')
  }
  if (localPart.includes('..')) {
    throw new Error('Email local part cannot contain consecutive dots')
  }
  if (!domainPart) {
    throw new Error('Email domain cannot be empty')
  }
  if (domainPart.length > 253) {
    throw new Error('Email domain is too long (max 253 characters)')
  }
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) {
    throw new Error('Email domain cannot start or end with a dot')
  }
  if (domainPart.includes('..')) {
    throw new Error('Email domain cannot contain consecutive dots')
  }
  if (!domainPart.includes('.')) {
    throw new Error('Email domain must contain at least one dot')
  }
  const domainLabels = domainPart.split('.')
  for (const domainLabel of domainLabels) {
    if (domainLabel.length === 0) {
      throw new Error('Email domain labels cannot be empty')
    }
    if (domainLabel.length > 63) {
      throw new Error('Email domain labels cannot exceed 63 characters')
    }
    if (domainLabel.startsWith('-') || domainLabel.endsWith('-')) {
      throw new Error('Email domain labels cannot start or end with a hyphen')
    }
    if (domainLabel.includes('--')) {
      throw new Error('Email domain labels cannot contain consecutive hyphens')
    }
  }
}
