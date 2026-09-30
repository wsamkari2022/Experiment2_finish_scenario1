/**
 * countries.ts — the country list for the "A little about you" page, and the matching behind its search (since
 * 30 September 2026, the researcher's request: "a drop list of the country with ability to write some letters and
 * the list will try to match what the user wrote ... smart and elegant").
 *
 * THE LIST. Every inhabited country and territory with an ISO 3166-1 code, under its common English name, plus
 * Kosovo (XK, the code in common use). Uninhabited ones (Antarctica, Bouvet Island, Heard Island, South Georgia,
 * the US Minor Outlying Islands, the British Indian Ocean Territory, the French Southern Territories) are left out: no
 * participant can come from them. The question on screen is simply "Country" (the researcher, 30 September 2026). Written out here rather than taken from the browser (Intl.DisplayNames),
 * because browsers name some countries differently and a stored answer must not depend on the browser.
 *
 * THE MATCHING, in this order, then alphabetical inside each group:
 *   1. the whole name or another name typed in full ("uk", "usa", "ksa", "uae")
 *   2. the name starts with what was typed ("Sa" -> Saint Lucia, Samoa, San Marino, Sao Tome, Saudi Arabia ...)
 *   3. a word inside the name starts with it ("Sa" -> American Samoa, El Salvador, Western Sahara)
 *   4. another name starts with it ("hol" -> Netherlands, "ivory" -> Cote d'Ivoire, "tur" -> Turkiye)
 *   5. the two-letter code ("us" -> United States)
 *   6. the letters appear anywhere in the name
 * Accents, capitals, apostrophes and hyphens never matter ("sao tome", "cote d", "guinea b"). The part that matched is
 * returned so the list can show it in bold. Pure: checked by `npm run validate:session` (C9).
 */

export interface Country {
  /** ISO 3166-1 alpha-2 (XK for Kosovo). */
  code: string;
  name: string;
  /** Other names people type. */
  aka?: string[];
}

/** "Prefer not to say": always offered, always last. Stored with a null code. */
export const PREFER_NOT_TO_SAY = "Prefer not to say";
export const PREFER_NOT_TO_SAY_VALUE = "none";

export const COUNTRIES: Country[] = [
  { code: "AF", name: "Afghanistan" },
  { code: "AX", name: "Åland Islands" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AS", name: "American Samoa" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AI", name: "Anguilla" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AW", name: "Aruba" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BM", name: "Bermuda" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia and Herzegovina", aka: ["Bosnia"] },
  { code: "BW", name: "Botswana" },
  { code: "BR", name: "Brazil", aka: ["Brasil"] },
  { code: "VG", name: "British Virgin Islands" },
  { code: "BN", name: "Brunei" },
  { code: "BG", name: "Bulgaria" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cabo Verde", aka: ["Cape Verde"] },
  { code: "KH", name: "Cambodia" },
  { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" },
  { code: "BQ", name: "Caribbean Netherlands", aka: ["Bonaire", "Sint Eustatius", "Saba"] },
  { code: "KY", name: "Cayman Islands" },
  { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China", aka: ["PRC"] },
  { code: "CX", name: "Christmas Island" },
  { code: "CC", name: "Cocos (Keeling) Islands" },
  { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" },
  { code: "CG", name: "Congo", aka: ["Republic of the Congo", "Congo-Brazzaville"] },
  { code: "CK", name: "Cook Islands" },
  { code: "CR", name: "Costa Rica" },
  { code: "CI", name: "Côte d'Ivoire", aka: ["Ivory Coast"] },
  { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" },
  { code: "CW", name: "Curaçao" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czechia", aka: ["Czech Republic"] },
  { code: "CD", name: "Democratic Republic of the Congo", aka: ["DRC", "DR Congo", "Congo-Kinshasa"] },
  { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini", aka: ["Swaziland"] },
  { code: "ET", name: "Ethiopia" },
  { code: "FK", name: "Falkland Islands" },
  { code: "FO", name: "Faroe Islands" },
  { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GF", name: "French Guiana" },
  { code: "PF", name: "French Polynesia", aka: ["Tahiti"] },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany", aka: ["Deutschland"] },
  { code: "GH", name: "Ghana" },
  { code: "GI", name: "Gibraltar" },
  { code: "GR", name: "Greece" },
  { code: "GL", name: "Greenland" },
  { code: "GD", name: "Grenada" },
  { code: "GP", name: "Guadeloupe" },
  { code: "GU", name: "Guam" },
  { code: "GT", name: "Guatemala" },
  { code: "GG", name: "Guernsey" },
  { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "VA", name: "Holy See", aka: ["Vatican City", "Vatican"] },
  { code: "HN", name: "Honduras" },
  { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland", aka: ["Eire"] },
  { code: "IM", name: "Isle of Man" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" },
  { code: "JE", name: "Jersey" },
  { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" },
  { code: "XK", name: "Kosovo" },
  { code: "KW", name: "Kuwait" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Laos" },
  { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MO", name: "Macao", aka: ["Macau"] },
  { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MQ", name: "Martinique" },
  { code: "MR", name: "Mauritania" },
  { code: "MU", name: "Mauritius" },
  { code: "YT", name: "Mayotte" },
  { code: "MX", name: "Mexico" },
  { code: "FM", name: "Micronesia" },
  { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" },
  { code: "ME", name: "Montenegro" },
  { code: "MS", name: "Montserrat" },
  { code: "MA", name: "Morocco" },
  { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar", aka: ["Burma"] },
  { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands", aka: ["Holland", "The Netherlands"] },
  { code: "NC", name: "New Caledonia" },
  { code: "NZ", name: "New Zealand", aka: ["Aotearoa"] },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "NU", name: "Niue" },
  { code: "NF", name: "Norfolk Island" },
  { code: "KP", name: "North Korea", aka: ["DPRK"] },
  { code: "MK", name: "North Macedonia", aka: ["Macedonia"] },
  { code: "MP", name: "Northern Mariana Islands" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PS", name: "Palestine" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PN", name: "Pitcairn Islands" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "PR", name: "Puerto Rico" },
  { code: "QA", name: "Qatar" },
  { code: "RE", name: "Réunion" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia", aka: ["Russian Federation"] },
  { code: "RW", name: "Rwanda" },
  { code: "BL", name: "Saint Barthélemy", aka: ["St Barthelemy", "St Barts"] },
  { code: "SH", name: "Saint Helena", aka: ["St Helena", "Ascension", "Tristan da Cunha"] },
  { code: "KN", name: "Saint Kitts and Nevis", aka: ["St Kitts and Nevis"] },
  { code: "LC", name: "Saint Lucia", aka: ["St Lucia"] },
  { code: "MF", name: "Saint Martin", aka: ["St Martin"] },
  { code: "PM", name: "Saint Pierre and Miquelon", aka: ["St Pierre and Miquelon"] },
  { code: "VC", name: "Saint Vincent and the Grenadines", aka: ["St Vincent and the Grenadines"] },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "ST", name: "São Tomé and Príncipe" },
  { code: "SA", name: "Saudi Arabia", aka: ["KSA", "Kingdom of Saudi Arabia"] },
  { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SX", name: "Sint Maarten" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa", aka: ["RSA"] },
  { code: "KR", name: "South Korea", aka: ["Korea", "Republic of Korea"] },
  { code: "SS", name: "South Sudan" },
  { code: "ES", name: "Spain", aka: ["España"] },
  { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" },
  { code: "SJ", name: "Svalbard and Jan Mayen" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "SY", name: "Syria" },
  { code: "TW", name: "Taiwan" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste", aka: ["East Timor"] },
  { code: "TG", name: "Togo" },
  { code: "TK", name: "Tokelau" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Türkiye", aka: ["Turkey"] },
  { code: "TM", name: "Turkmenistan" },
  { code: "TC", name: "Turks and Caicos Islands" },
  { code: "TV", name: "Tuvalu" },
  { code: "VI", name: "U.S. Virgin Islands", aka: ["US Virgin Islands", "United States Virgin Islands"] },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates", aka: ["UAE", "Emirates"] },
  { code: "GB", name: "United Kingdom", aka: ["UK", "Britain", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland"] },
  { code: "US", name: "United States", aka: ["USA", "US", "America", "United States of America"] },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VU", name: "Vanuatu" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam", aka: ["Viet Nam"] },
  { code: "WF", name: "Wallis and Futuna" },
  { code: "EH", name: "Western Sahara" },
  { code: "YE", name: "Yemen" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
];

/* ------------------------------------------------------------------ matching */

/** One character, folded: lower case, no accents; spaces, hyphens and slashes become a space; other marks vanish. */
function fold(ch: string): string {
  if (/[\s\-/]/.test(ch)) return " ";
  const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /^[a-z0-9]+$/.test(base) ? base : "";
}

/** Folds a whole string and remembers, for each folded character, which original character it came from. */
export function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const f = fold(text[i]);
    for (const c of f) {
      if (c === " " && (folded === "" || folded.endsWith(" "))) continue;
      folded += c;
      map.push(i);
    }
  }
  if (folded.endsWith(" ")) { folded = folded.slice(0, -1); map.pop(); }
  return { folded, map };
}

export const foldText = (text: string): string => foldWithMap(text).folded;

export interface CountryMatch {
  country: Country;
  /** 1-6 as in the header; lower is better. */
  rank: number;
  /** The matched part of the NAME, as [start, end) in the original name; null when an other name or the code matched. */
  highlight: [number, number] | null;
  /** The other name that matched, to show beside the name ("also known as UK"). */
  viaAka: string | null;
}

const FOLDED = COUNTRIES.map((c) => ({
  c, name: foldWithMap(c.name), aka: (c.aka ?? []).map((a) => ({ a, f: foldText(a) })),
}));

/** Every country that matches what was typed, best first; the whole list, alphabetically, when nothing is typed. */
export function matchCountries(query: string): CountryMatch[] {
  const q = foldText(query);
  const byName = (a: CountryMatch, b: CountryMatch) =>
    a.rank - b.rank || a.country.name.localeCompare(b.country.name, "en", { sensitivity: "base" });
  if (!q) {
    return COUNTRIES.map((country) => ({ country, rank: 2, highlight: null, viaAka: null })).sort(byName);
  }
  const out: CountryMatch[] = [];
  for (const { c, name, aka } of FOLDED) {
    const span = (start: number): [number, number] => [name.map[start], name.map[start + q.length - 1] + 1];
    const fullAka = aka.find((x) => x.f === q);
    const wordAt = name.folded.indexOf(` ${q}`);
    const akaStart = aka.find((x) => x.f.startsWith(q) || x.f.includes(` ${q}`));
    const anywhere = name.folded.indexOf(q);
    let m: CountryMatch | null = null;
    if (name.folded === q) m = { country: c, rank: 1, highlight: span(0), viaAka: null };
    else if (fullAka) m = { country: c, rank: 1, highlight: null, viaAka: fullAka.a };
    else if (name.folded.startsWith(q)) m = { country: c, rank: 2, highlight: span(0), viaAka: null };
    else if (wordAt >= 0) m = { country: c, rank: 3, highlight: span(wordAt + 1), viaAka: null };
    else if (akaStart) m = { country: c, rank: 4, highlight: null, viaAka: akaStart.a };
    else if (q.length === 2 && c.code.toLowerCase() === q) m = { country: c, rank: 5, highlight: null, viaAka: null };
    else if (q.length >= 3 && anywhere >= 0) m = { country: c, rank: 6, highlight: span(anywhere), viaAka: null };
    if (m) out.push(m);
  }
  return out.sort(byName);
}

export function countryByCode(code: string | null | undefined): Country | null {
  return COUNTRIES.find((c) => c.code === code) ?? null;
}
