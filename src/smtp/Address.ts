import type { EmailRecipient, ProcessedContact } from '@app/Types.ts'

/**
 * Parses and formats email addresses.
 * @description Supports various address formats and header formatting.
 */
export class AddressParser {
  /**
   * Formats processed contact for email header.
   * @param address - Processed contact information
   * @returns Formatted address string
   */
  static formatAddressForHeader(address: ProcessedContact): string {
    if (address.displayName) {
      const escapedName = address.displayName.replace(/[",\\]/g, '\\$&')
      return `"${escapedName}" <${address.email}>`
    }
    return address.email
  }

  /**
   * Parses single email address from various formats.
   * @param address - Email address in string or EmailContact format
   * @returns Processed contact information
   * @throws {Error} When address format is invalid
   */
  static parseAddress(address: EmailRecipient): ProcessedContact {
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
   * Parses list of email addresses.
   * @param addresses - Email addresses in various formats
   * @returns Array of processed contact information
   */
  static parseAddressList(addresses: EmailRecipient): ProcessedContact[] {
    if (typeof addresses === 'string') {
      return addresses.split(',').map((addr) => this.parseAddress(addr.trim()))
    }
    if (Array.isArray(addresses)) {
      return addresses.map((addr) => this.parseAddress(addr))
    }
    return [this.parseAddress(addresses)]
  }
}
