/**
 * Returns navigator.language if it is a valid BCP-47 language tag, otherwise
 * undefined so Intl/Date APIs fall back to the runtime default locale.
 *
 * Guards against environments where navigator.language is missing, empty, or
 * an invalid value (e.g. the literal string "undefined" seen in some headless
 * browsers), which would otherwise make Intl.DateTimeFormat throw a RangeError.
 *
 * @returns {string|undefined} a valid locale tag, or undefined to use the default
 */
export const getPreferredLocale = () => {
  const lang = typeof navigator !== 'undefined' ? navigator.language : undefined;
  if (!lang) return undefined;
  try {
    Intl.getCanonicalLocales(lang);
    return lang;
  } catch {
    return undefined;
  }
};
