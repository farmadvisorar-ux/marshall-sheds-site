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
