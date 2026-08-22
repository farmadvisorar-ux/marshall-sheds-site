import site from '../data/site.json';

/**
 * A phone number that exists in site.json but is not answered yet must not
 * reach a visitor, the footer NAP or the business schema. `phonePending`
 * mirrors `emailPending` so a line can be recorded before it goes live —
 * without it, typing a number into site.json publishes it everywhere at once,
 * including the NAP that directories and Google cross-reference.
 *
 * Everything that renders the number goes through here, so there is one place
 * to get it wrong rather than nine.
 */
export const phoneLive: boolean = Boolean(site.phone) && !site.phonePending;

/** `tel:` target. Only meaningful when `phoneLive` is true. */
export const phoneHref = `tel:${site.phoneRaw || site.phone}`;

/**
 * Person a caller should ask for. Optional — the copy reads correctly without
 * it, so an operation with no named contact simply omits the phrase rather
 * than printing "ask for" and trailing off.
 */
export const contactName: string = (site as { contactName?: string }).contactName ?? '';

/**
 * Postal address, if there is one to publish.
 *
 * A shared address is the half of the duplicate-listing problem a separate
 * phone number does not solve: Google treats same-category listings at one
 * address as duplicates whatever the number. So this can be emptied, and
 * everything that renders it degrades instead of printing stray commas or an
 * address line with nothing on it.
 */
const addr = (site as { address?: Record<string, string> }).address ?? {};

export const addressParts: string[] = [addr.street, addr.city, addr.region, addr.postal]
  .map((s) => (s ?? '').trim())
  .filter(Boolean);

export const addressLive: boolean = addressParts.length > 0;

/** Single-line form, e.g. "360 PR 1031, Marshall, TX 75672". */
export const addressLine: string = addressParts.join(', ');

/** Street on its own line, locality on the next — the NAP block's shape. */
export const addressStreet: string = (addr.street ?? '').trim();
export const addressLocality: string = [
  [addr.city, addr.region].map((s) => (s ?? '').trim()).filter(Boolean).join(', '),
  (addr.postal ?? '').trim(),
]
  .filter(Boolean)
  .join(' ');
