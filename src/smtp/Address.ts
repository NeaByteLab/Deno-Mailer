import type * as Types from '@app/Types.ts'

/**
 * Parse and format addresses.
 * @description Handles recipient formats and header-safe output.
 */
export class SmtpAddress {
  /**
   * Format address for header.
   * @description Escapes display name and formats mailbox output.
   * @param address - Processed contact information
   * @returns Formatted address string
   */
  static formatForHeader(address: Types.ProcessedContact): string {
    if (address.displayName) {
      const escapedName = address.displayName.replace(/[",\\]/g, '\\$&')
      return `"${escapedName}" <${address.email}>`
    }
    return address.email
  }

  /**
   * Parse one email address.
   * @description Converts string or object into normalized contact.
   * @param address - Email address in string or EmailContact format
   * @returns Processed contact information
   * @throws {Error} When address format is invalid
   */
  static parseAddress(address: Types.EmailRecipient): Types.ProcessedContact {
    if (typeof address === 'string') {
      const match = address.match(/^(.+?)\s*<(.+)>$/)
      if (match && match[1] && match[2]) {
        const displayName = match[1].trim().replace(/^["']|["']$/g, '')
        const email = match[2].trim()
        return { email, displayName }
      }
      return { email: address.trim() }
    }
    if (typeof address === 'object' && 'address' in address) {
      const trimmedName = address.name?.trim()
      return {
        email: address.address.trim(),
        ...(trimmedName && { displayName: trimmedName })
      }
    }
    throw new Error(`Invalid address format: ${JSON.stringify(address)}`)
  }

  /**
   * Parse email address list.
   * @description Normalizes one or many recipient entries.
   * @param addresses - Email addresses in various formats
   * @returns Array of processed contact information
   */
  static parseAddressList(addresses: Types.EmailRecipient): Types.ProcessedContact[] {
    if (typeof addresses === 'string') {
      return addresses.split(',').map((addr) => this.parseAddress(addr.trim()))
    }
    if (Array.isArray(addresses)) {
      return addresses.map((addr) => this.parseAddress(addr))
    }
    return [this.parseAddress(addresses)]
  }
}
