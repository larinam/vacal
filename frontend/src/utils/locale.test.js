import {afterEach, describe, expect, it, vi} from 'vitest';
import {getPreferredLocale} from './locale';

const stubLanguage = (value) =>
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(value);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getPreferredLocale', () => {
  it('returns the navigator language when it is a valid BCP-47 tag', () => {
    stubLanguage('en-US');
    expect(getPreferredLocale()).toBe('en-US');
  });

  it('returns undefined when navigator.language is the literal string "undefined"', () => {
    stubLanguage('undefined');
    expect(getPreferredLocale()).toBeUndefined();
  });

  it('returns undefined for an empty language string', () => {
    stubLanguage('');
    expect(getPreferredLocale()).toBeUndefined();
  });

  it('returns undefined when navigator.language is missing', () => {
    stubLanguage(undefined);
    expect(getPreferredLocale()).toBeUndefined();
  });

  it('produces a value Intl.DateTimeFormat accepts even for invalid input', () => {
    stubLanguage('undefined');
    expect(
      () => new Intl.DateTimeFormat(getPreferredLocale(), {weekday: 'short'})
    ).not.toThrow();
  });
});
