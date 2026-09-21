import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import vi from 'i18n-iso-countries/langs/vi.json';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

// Phone numbers are stored as E.164 ("+84912345678"): the country code is part of the number.
// libphonenumber knows every country's calling code and number rules.

countries.registerLocale(en);
countries.registerLocale(vi);

export type { CountryCode };
export type Country = { code: CountryCode; name: string; dial: string };

export const DEFAULT_COUNTRY: CountryCode = 'VN';

export const flag = (code: string) => code.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
export const dialOf = (code: CountryCode) => `+${getCountryCallingCode(code)}`;

const nameOf = (code: string, lang: string) =>
  countries.getName(code, lang, { select: 'alias' }) || countries.getName(code, lang) || countries.getName(code, 'en') || code;

// Every country, sorted by name in the app language, Vietnam first.
export const listCountries = (lang: string): Country[] =>
  getCountries()
    .map((code) => ({ code, name: nameOf(code, lang), dial: dialOf(code) }))
    .sort((a, b) => (a.code === DEFAULT_COUNTRY ? -1 : b.code === DEFAULT_COUNTRY ? 1 : a.name.localeCompare(b.name, lang)));

// "Việt Nam" and "viet nam" both match "viet"
export const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

export const searchCountries = (all: Country[], q: string) => {
  const needle = fold(q.trim());
  if (!needle) return all;
  const digits = needle.replace(/\D/g, '');
  return all.filter((c) => fold(c.name).includes(needle) || c.code.toLowerCase() === needle || (digits && c.dial.slice(1).startsWith(digits)));
};

// "+84912345678" (or a legacy local "0912345678") -> country + national number as typed locally.
export const parsePhone = (raw?: string): { country: CountryCode; national: string } => {
  const s = (raw ?? '').trim();
  if (!s) return { country: DEFAULT_COUNTRY, national: '' };
  const p = parsePhoneNumberFromString(s, DEFAULT_COUNTRY);
  if (!p) return { country: DEFAULT_COUNTRY, national: s.replace(/\D/g, '') };
  // "+1" is shared by several countries: fall back to the first one that uses the code
  const country = p.country ?? getCountries().find((c) => getCountryCallingCode(c) === p.countryCallingCode) ?? DEFAULT_COUNTRY;
  return { country, national: p.nationalNumber };
};

// Local input + chosen country -> E.164, or '' if it isn't a real number for that country.
export const buildPhone = (country: CountryCode, national: string) => {
  const p = parsePhoneNumberFromString(national, country);
  return p?.isValid() ? p.number : '';
};

// Whatever someone types into the search box -> E.164 (without "+" it is read as a Vietnamese number).
// Keep in sync with normPhone in functions/index.js.
export const normPhone = (s: string) => parsePhoneNumberFromString(s.trim(), DEFAULT_COUNTRY)?.number ?? '';
