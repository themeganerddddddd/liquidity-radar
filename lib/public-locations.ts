export type PublicLocationInput = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

export type NormalizedPublicLocation = {
  country: string;
  state: string;
  city: string;
  stateCode: string;
  display: string;
};

const unitedStates: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  PR: "Puerto Rico",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  VI: "U.S. Virgin Islands",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

const canadianProvinces: Record<string, string> = {
  A0: "Alberta",
  AB: "Alberta",
  A1: "British Columbia",
  BC: "British Columbia",
  A2: "Manitoba",
  MB: "Manitoba",
  A3: "New Brunswick",
  NB: "New Brunswick",
  A4: "Newfoundland and Labrador",
  NL: "Newfoundland and Labrador",
  A5: "Nova Scotia",
  NS: "Nova Scotia",
  A6: "Ontario",
  ON: "Ontario",
  A7: "Prince Edward Island",
  PE: "Prince Edward Island",
  A8: "Quebec",
  QC: "Quebec",
  A9: "Saskatchewan",
  SK: "Saskatchewan",
  B0: "Yukon",
  YT: "Yukon",
  NT: "Northwest Territories",
  NU: "Nunavut",
};

const secCountryCodes: Record<string, string> = {
  "2M": "Germany",
  C0: "United Arab Emirates",
  D0: "Bermuda",
  E9: "Cayman Islands",
  F4: "China",
  I0: "France",
  K3: "Hong Kong",
  L2: "Ireland",
  L3: "Israel",
  M0: "Japan",
  N4: "Luxembourg",
  O5: "Mexico",
  P7: "Netherlands",
  S3: "Qatar",
  T3: "South Africa",
  U0: "Singapore",
  V8: "Switzerland",
  X0: "United Kingdom",
  X1: "United States",
  Y9: "Jersey",
  Z4: "Canada",
};

const countryAliases: Record<string, string> = {
  US: "United States",
  USA: "United States",
  "U.S.": "United States",
  "U.S.A.": "United States",
  "UNITED STATES": "United States",
  X1: "United States",
  CA: "Canada",
  CAN: "Canada",
  CANADA: "Canada",
  Z4: "Canada",
  UK: "United Kingdom",
  "UNITED KINGDOM": "United Kingdom",
  X0: "United Kingdom",
};

function titleCase(value: string) {
  if (!value || value !== value.toLocaleUpperCase()) return value.trim();
  return value
    .toLocaleLowerCase()
    .replace(/(^|[\s(/&'-])\p{L}/gu, (letter) => letter.toLocaleUpperCase())
    .replace(/\bU\.s\.\b/g, "U.S.");
}

function codeForName(names: Record<string, string>, value: string): string {
  const normalized = value.trim().toLocaleLowerCase();
  return (
    Object.entries(names).find(
      ([, name]) => name.toLocaleLowerCase() === normalized,
    )?.[0] ?? ""
  );
}

function normalizeCountry(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  const alias = countryAliases[raw.toLocaleUpperCase()];
  if (alias) return alias;
  const coded = secCountryCodes[raw.toLocaleUpperCase()];
  if (coded) return coded;
  return titleCase(raw);
}

export function normalizePublicLocation(
  location?: PublicLocationInput | null,
): NormalizedPublicLocation {
  if (!location) {
    return {
      country: "",
      state: "",
      city: "",
      stateCode: "",
      display: "Location not established",
    };
  }

  const rawCity = location.city?.trim() ?? "";
  const rawState = location.state?.trim() ?? "";
  const rawCountry = location.country?.trim() ?? "";
  const stateCode = rawState.toLocaleUpperCase();
  let country = "";
  let state = "";
  let normalizedStateCode = "";

  if (unitedStates[stateCode]) {
    country = "United States";
    state = unitedStates[stateCode];
    normalizedStateCode = stateCode;
  } else if (canadianProvinces[stateCode]) {
    country = "Canada";
    state = canadianProvinces[stateCode];
  } else {
    const fullUnitedStatesCode = codeForName(unitedStates, rawState);
    const fullCanadianCode = codeForName(canadianProvinces, rawState);
    if (fullUnitedStatesCode) {
      country = "United States";
      state = unitedStates[fullUnitedStatesCode];
      normalizedStateCode = fullUnitedStatesCode;
    } else if (fullCanadianCode) {
      country = "Canada";
      state = canadianProvinces[fullCanadianCode];
    } else if (/,\s*canada$/i.test(rawCountry)) {
      country = "Canada";
      state = titleCase(rawCountry.replace(/,\s*canada$/i, ""));
    } else {
      country =
        normalizeCountry(rawCountry) || secCountryCodes[stateCode] || "";
    }
  }

  if (country === "United States" && !state && rawState) {
    const code = codeForName(unitedStates, rawState);
    state = code ? unitedStates[code] : titleCase(rawState);
    normalizedStateCode = code;
  }
  if (country === "Canada" && !state && rawState) {
    const code = codeForName(canadianProvinces, rawState);
    state = code ? canadianProvinces[code] : titleCase(rawState);
  }

  const city = titleCase(rawCity);
  const display =
    [country, state, city].filter(Boolean).join(" · ") ||
    "Location not established";

  return {
    country,
    state,
    city,
    stateCode: normalizedStateCode,
    display,
  };
}

export function formatMetroLocation(name: string) {
  const match = name.match(/^(.+?),\s*([A-Z]{2}(?:-[A-Z]{2})*)$/);
  if (!match) return `United States · ${name} (city/metro area)`;
  const states = match[2]
    .split("-")
    .map((code) => unitedStates[code] ?? code)
    .join(" / ");
  return `United States · ${states} · ${match[1]} (city/metro area)`;
}
