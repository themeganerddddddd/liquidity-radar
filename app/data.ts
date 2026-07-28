import type { GeographicRelationship } from "../lib/regional";

export type MoneyRange = {
  low: number;
  median: number;
  high: number;
};

export type Person = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  role: string;
  organization: string;
  industry: string;
  location: string;
  eventType: string;
  eventDate: string;
  remaining: MoneyRange;
  created: MoneyRange;
  deployed: MoneyRange;
  confidence: number;
  radar: number;
  momentum: number;
  sourceCount: number;
  status: "Published" | "Claimed" | "Pending review";
  primaryRegionSlug: string;
  eventRegionSlug: string;
  geographicRelationships: GeographicRelationship[];
};

export type LiquidityEvent = {
  id: string;
  person: string;
  organization: string;
  type: string;
  place: string;
  date: string;
  sourceDate: string;
  gross: MoneyRange;
  net: MoneyRange;
  confidence: number;
  status: "Completed" | "Proposed" | "Announced" | "Withdrawn";
  classification: "observed" | "calculated" | "estimated" | "inferred";
  source: string;
  explanation: string;
  personId: string;
  personSlug: string;
  personRole: string;
  organizationSlug: string;
  organizationClass: "public" | "private";
  regionSlug: string;
  regionName: string;
  state: string;
  metro: string;
  county: string;
  city: string;
  industry: string;
  naics: string;
  category: "liquidity" | "deployment";
  description: string;
};

export type Region = {
  slug: string;
  name: string;
  code: string;
  metro: string;
  county: string;
  city: string;
  type: "state" | "metro" | "county" | "subregion";
  hierarchy: string[];
  coordinates: [number, number];
  created: number;
  controlled: number;
  deployed: number;
  retained: number;
  leakage: number;
  attraction: number;
  people: number;
  eventCount: number;
  highConfidencePeople: number;
  momentum: number;
  industries: { name: string; share: number }[];
};

export type OrganizationProfile = {
  id: string;
  slug: string;
  name: string;
  type: string;
  industry: string;
  publicClassification: "public" | "private";
  regionSlugs: string[];
};

const firstNames = [
  "Amara",
  "Theo",
  "Mina",
  "Julian",
  "Sofia",
  "Darius",
  "Elena",
  "Marcus",
  "Priya",
  "Jonah",
  "Leila",
  "Caleb",
  "Nadia",
  "Felix",
  "Imani",
  "Owen",
  "Camila",
  "Ravi",
  "Mae",
  "Elliot",
  "Noor",
  "Simon",
  "Avery",
  "Mateo",
  "June",
  "Anika",
  "Desmond",
  "Lena",
  "Kian",
  "Talia",
  "Maya",
  "Grant",
  "Yara",
  "Nico",
  "Ada",
  "Wes",
  "Rina",
  "Hugo",
  "Zara",
  "Miles",
];

const lastNames = [
  "Voss",
  "Navarro",
  "Chen",
  "Mercer",
  "Okafor",
  "Reyes",
  "Park",
  "Bennett",
  "Kapoor",
  "Ellison",
  "Rahman",
  "Stone",
  "Haddad",
  "Laurent",
  "Brooks",
  "Hale",
  "Santos",
  "Mehta",
  "Kim",
  "Wilder",
  "Aziz",
  "Kline",
  "Rhodes",
  "Silva",
  "Tan",
  "Rao",
  "Cole",
  "Meyer",
  "Shah",
  "Diaz",
  "Lin",
  "Foster",
  "Nasser",
  "Costa",
  "Bell",
  "Quinn",
  "Ito",
  "Larsen",
  "Malik",
  "Price",
];

export const organizations = [
  "Northstar BioSystems",
  "Cedarline Software",
  "Atlas Gridworks",
  "Mercury Robotics",
  "Juniper Health",
  "Lumen Harbor",
  "Blue Mesa Foods",
  "Kestrel Materials",
  "Signal Orchard",
  "Aperture Logistics",
  "Commonfield Energy",
  "Verdant Compute",
  "Redwood Clinical",
  "Morrow Aerospace",
  "Mosaic Water",
  "Ironleaf Security",
  "Aster Labs",
  "Hearthline Housing",
  "Echelon Circuits",
  "Civic Spring",
  "Noble River Capital",
  "Waypoint Diagnostics",
  "Arborlight Media",
  "Sable Mobility",
  "Foundry Creek",
  "Keystone Climate",
  "Sunward Therapeutics",
  "Greyhaven Data",
  "Oxbow Education",
  "Tandem Industrial",
  "Fieldstone Ventures",
  "Canopy Family Partners",
  "Summit Civic Foundation",
  "Beacon Ridge Holdings",
  "Mariner Growth Fund",
  "Copperline Analytics",
  "Prairie Sky Networks",
  "Evergreen Cellworks",
  "Harborstone Payments",
  "Cascade Quantum",
  "Palmetto Medical",
  "Great Lakes Automation",
  "Desert Bloom Ventures",
  "Bluegrass Biologics",
  "Frontier Battery",
  "Allegheny Research",
  "Twin Rivers Systems",
  "Granite State Health",
  "High Plains Robotics",
  "Magnolia Infrastructure",
  "Sunbelt Circularity",
  "Wasatch Climate Partners",
  "Ozark Precision",
  "Gulfstream AgTech",
  "Pioneer Data Trust",
  "Acadia Marine Science",
  "Hoosier Digital Works",
  "Badger Advanced Materials",
  "Peachtree Growth",
  "Silver State Mobility",
  "Empire Lake Capital",
  "Red River Diagnostics",
  "Mountain West Compute",
  "Diamond State Ventures",
  "Ocean State Biosystems",
  "Aloha Grid Labs",
  "Nutmeg Security",
  "Yellowstone Industrial",
  "Tar Heel Family Partners",
  "Garden State Therapeutics",
];

const industries = [
  "Life Sciences",
  "Enterprise Software",
  "Energy",
  "Advanced Manufacturing",
  "Healthcare",
  "Financial Technology",
  "Food & Agriculture",
  "Climate Technology",
];

type RegionalGeography = {
  slug: string;
  location: string;
  regionName: string;
  state: string;
  metro: string;
  county: string;
  city: string;
};

const coreRegionalGeographies = [
  {
    slug: "washington-arlington-alexandria",
    location: "Washington, DC",
    regionName: "Washington–Arlington–Alexandria Metro",
    state: "District of Columbia",
    metro: "Washington–Arlington–Alexandria",
    county: "District of Columbia",
    city: "Washington",
  },
  {
    slug: "montgomery-county-md",
    location: "Rockville, MD",
    regionName: "Montgomery County, Maryland",
    state: "Maryland",
    metro: "Washington–Arlington–Alexandria",
    county: "Montgomery County",
    city: "Rockville",
  },
  {
    slug: "maryland",
    location: "Baltimore, MD",
    regionName: "Maryland",
    state: "Maryland",
    metro: "Baltimore–Columbia–Towson",
    county: "Baltimore County",
    city: "Baltimore",
  },
  {
    slug: "northern-virginia",
    location: "Arlington, VA",
    regionName: "Northern Virginia",
    state: "Virginia",
    metro: "Washington–Arlington–Alexandria",
    county: "Arlington County",
    city: "Arlington",
  },
  {
    slug: "new-york",
    location: "New York, NY",
    regionName: "New York Metro",
    state: "New York",
    metro: "New York–Newark–Jersey City",
    county: "New York County",
    city: "New York",
  },
  {
    slug: "new-orleans-metairie",
    location: "New Orleans, LA",
    regionName: "New Orleans–Metairie Metro",
    state: "Louisiana",
    metro: "New Orleans–Metairie",
    county: "Orleans Parish",
    city: "New Orleans",
  },
  {
    slug: "boston-cambridge",
    location: "Boston, MA",
    regionName: "Boston–Cambridge Metro",
    state: "Massachusetts",
    metro: "Boston–Cambridge–Newton",
    county: "Suffolk County",
    city: "Boston",
  },
  {
    slug: "austin-round-rock",
    location: "Austin, TX",
    regionName: "Austin–Round Rock Metro",
    state: "Texas",
    metro: "Austin–Round Rock",
    county: "Travis County",
    city: "Austin",
  },
  {
    slug: "raleigh-durham",
    location: "Raleigh, NC",
    regionName: "Raleigh–Durham",
    state: "North Carolina",
    metro: "Raleigh–Cary",
    county: "Wake County",
    city: "Raleigh",
  },
  {
    slug: "san-diego-carlsbad",
    location: "San Diego, CA",
    regionName: "San Diego–Carlsbad",
    state: "California",
    metro: "San Diego–Chula Vista–Carlsbad",
    county: "San Diego County",
    city: "San Diego",
  },
] satisfies RegionalGeography[];

const stateMarketSeeds = [
  {
    slug: "alabama",
    name: "Alabama",
    code: "AL",
    metro: "Birmingham–Hoover",
    county: "Jefferson County",
    city: "Birmingham",
    longitude: -86.8025,
    latitude: 33.5207,
  },
  {
    slug: "alaska",
    name: "Alaska",
    code: "AK",
    metro: "Anchorage",
    county: "Anchorage Municipality",
    city: "Anchorage",
    longitude: -149.9003,
    latitude: 61.2181,
  },
  {
    slug: "arizona",
    name: "Arizona",
    code: "AZ",
    metro: "Phoenix–Mesa–Chandler",
    county: "Maricopa County",
    city: "Phoenix",
    longitude: -112.074,
    latitude: 33.4484,
  },
  {
    slug: "arkansas",
    name: "Arkansas",
    code: "AR",
    metro: "Little Rock–North Little Rock–Conway",
    county: "Pulaski County",
    city: "Little Rock",
    longitude: -92.2896,
    latitude: 34.7465,
  },
  {
    slug: "colorado",
    name: "Colorado",
    code: "CO",
    metro: "Denver–Aurora–Lakewood",
    county: "Denver County",
    city: "Denver",
    longitude: -104.9903,
    latitude: 39.7392,
  },
  {
    slug: "connecticut",
    name: "Connecticut",
    code: "CT",
    metro: "Hartford–East Hartford–Middletown",
    county: "Hartford County",
    city: "Hartford",
    longitude: -72.6734,
    latitude: 41.7658,
  },
  {
    slug: "delaware",
    name: "Delaware",
    code: "DE",
    metro: "Philadelphia–Camden–Wilmington",
    county: "New Castle County",
    city: "Wilmington",
    longitude: -75.5398,
    latitude: 39.7391,
  },
  {
    slug: "florida",
    name: "Florida",
    code: "FL",
    metro: "Miami–Fort Lauderdale–Pompano Beach",
    county: "Miami-Dade County",
    city: "Miami",
    longitude: -80.1918,
    latitude: 25.7617,
  },
  {
    slug: "georgia",
    name: "Georgia",
    code: "GA",
    metro: "Atlanta–Sandy Springs–Alpharetta",
    county: "Fulton County",
    city: "Atlanta",
    longitude: -84.388,
    latitude: 33.749,
  },
  {
    slug: "hawaii",
    name: "Hawaii",
    code: "HI",
    metro: "Urban Honolulu",
    county: "Honolulu County",
    city: "Honolulu",
    longitude: -157.8583,
    latitude: 21.3069,
  },
  {
    slug: "idaho",
    name: "Idaho",
    code: "ID",
    metro: "Boise City",
    county: "Ada County",
    city: "Boise",
    longitude: -116.2023,
    latitude: 43.615,
  },
  {
    slug: "illinois",
    name: "Illinois",
    code: "IL",
    metro: "Chicago–Naperville–Elgin",
    county: "Cook County",
    city: "Chicago",
    longitude: -87.6298,
    latitude: 41.8781,
  },
  {
    slug: "indiana",
    name: "Indiana",
    code: "IN",
    metro: "Indianapolis–Carmel–Anderson",
    county: "Marion County",
    city: "Indianapolis",
    longitude: -86.1581,
    latitude: 39.7684,
  },
  {
    slug: "iowa",
    name: "Iowa",
    code: "IA",
    metro: "Des Moines–West Des Moines",
    county: "Polk County",
    city: "Des Moines",
    longitude: -93.625,
    latitude: 41.5868,
  },
  {
    slug: "kansas",
    name: "Kansas",
    code: "KS",
    metro: "Wichita",
    county: "Sedgwick County",
    city: "Wichita",
    longitude: -97.3301,
    latitude: 37.6872,
  },
  {
    slug: "kentucky",
    name: "Kentucky",
    code: "KY",
    metro: "Louisville/Jefferson County",
    county: "Jefferson County",
    city: "Louisville",
    longitude: -85.7585,
    latitude: 38.2527,
  },
  {
    slug: "maine",
    name: "Maine",
    code: "ME",
    metro: "Portland–South Portland",
    county: "Cumberland County",
    city: "Portland",
    longitude: -70.2568,
    latitude: 43.6591,
  },
  {
    slug: "michigan",
    name: "Michigan",
    code: "MI",
    metro: "Detroit–Warren–Dearborn",
    county: "Wayne County",
    city: "Detroit",
    longitude: -83.0458,
    latitude: 42.3314,
  },
  {
    slug: "minnesota",
    name: "Minnesota",
    code: "MN",
    metro: "Minneapolis–St. Paul–Bloomington",
    county: "Hennepin County",
    city: "Minneapolis",
    longitude: -93.265,
    latitude: 44.9778,
  },
  {
    slug: "mississippi",
    name: "Mississippi",
    code: "MS",
    metro: "Jackson",
    county: "Hinds County",
    city: "Jackson",
    longitude: -90.1848,
    latitude: 32.2988,
  },
  {
    slug: "missouri",
    name: "Missouri",
    code: "MO",
    metro: "St. Louis",
    county: "St. Louis County",
    city: "St. Louis",
    longitude: -90.1994,
    latitude: 38.627,
  },
  {
    slug: "montana",
    name: "Montana",
    code: "MT",
    metro: "Billings",
    county: "Yellowstone County",
    city: "Billings",
    longitude: -108.5007,
    latitude: 45.7833,
  },
  {
    slug: "nebraska",
    name: "Nebraska",
    code: "NE",
    metro: "Omaha–Council Bluffs",
    county: "Douglas County",
    city: "Omaha",
    longitude: -95.998,
    latitude: 41.2565,
  },
  {
    slug: "nevada",
    name: "Nevada",
    code: "NV",
    metro: "Las Vegas–Henderson–Paradise",
    county: "Clark County",
    city: "Las Vegas",
    longitude: -115.1398,
    latitude: 36.1699,
  },
  {
    slug: "new-hampshire",
    name: "New Hampshire",
    code: "NH",
    metro: "Manchester–Nashua",
    county: "Hillsborough County",
    city: "Manchester",
    longitude: -71.4548,
    latitude: 42.9956,
  },
  {
    slug: "new-jersey",
    name: "New Jersey",
    code: "NJ",
    metro: "New York–Newark–Jersey City",
    county: "Essex County",
    city: "Newark",
    longitude: -74.1724,
    latitude: 40.7357,
  },
  {
    slug: "new-mexico",
    name: "New Mexico",
    code: "NM",
    metro: "Albuquerque",
    county: "Bernalillo County",
    city: "Albuquerque",
    longitude: -106.6504,
    latitude: 35.0844,
  },
  {
    slug: "north-dakota",
    name: "North Dakota",
    code: "ND",
    metro: "Fargo",
    county: "Cass County",
    city: "Fargo",
    longitude: -96.7898,
    latitude: 46.8772,
  },
  {
    slug: "ohio",
    name: "Ohio",
    code: "OH",
    metro: "Columbus",
    county: "Franklin County",
    city: "Columbus",
    longitude: -82.9988,
    latitude: 39.9612,
  },
  {
    slug: "oklahoma",
    name: "Oklahoma",
    code: "OK",
    metro: "Oklahoma City",
    county: "Oklahoma County",
    city: "Oklahoma City",
    longitude: -97.5164,
    latitude: 35.4676,
  },
  {
    slug: "oregon",
    name: "Oregon",
    code: "OR",
    metro: "Portland–Vancouver–Hillsboro",
    county: "Multnomah County",
    city: "Portland",
    longitude: -122.6765,
    latitude: 45.5231,
  },
  {
    slug: "pennsylvania",
    name: "Pennsylvania",
    code: "PA",
    metro: "Philadelphia–Camden–Wilmington",
    county: "Philadelphia County",
    city: "Philadelphia",
    longitude: -75.1652,
    latitude: 39.9526,
  },
  {
    slug: "rhode-island",
    name: "Rhode Island",
    code: "RI",
    metro: "Providence–Warwick",
    county: "Providence County",
    city: "Providence",
    longitude: -71.4128,
    latitude: 41.824,
  },
  {
    slug: "south-carolina",
    name: "South Carolina",
    code: "SC",
    metro: "Charleston–North Charleston",
    county: "Charleston County",
    city: "Charleston",
    longitude: -79.9311,
    latitude: 32.7765,
  },
  {
    slug: "south-dakota",
    name: "South Dakota",
    code: "SD",
    metro: "Sioux Falls",
    county: "Minnehaha County",
    city: "Sioux Falls",
    longitude: -96.7311,
    latitude: 43.5446,
  },
  {
    slug: "tennessee",
    name: "Tennessee",
    code: "TN",
    metro: "Nashville–Davidson–Murfreesboro–Franklin",
    county: "Davidson County",
    city: "Nashville",
    longitude: -86.7816,
    latitude: 36.1627,
  },
  {
    slug: "utah",
    name: "Utah",
    code: "UT",
    metro: "Salt Lake City",
    county: "Salt Lake County",
    city: "Salt Lake City",
    longitude: -111.891,
    latitude: 40.7608,
  },
  {
    slug: "vermont",
    name: "Vermont",
    code: "VT",
    metro: "Burlington–South Burlington",
    county: "Chittenden County",
    city: "Burlington",
    longitude: -73.2121,
    latitude: 44.4759,
  },
  {
    slug: "washington",
    name: "Washington",
    code: "WA",
    metro: "Seattle–Tacoma–Bellevue",
    county: "King County",
    city: "Seattle",
    longitude: -122.3321,
    latitude: 47.6062,
  },
  {
    slug: "west-virginia",
    name: "West Virginia",
    code: "WV",
    metro: "Charleston",
    county: "Kanawha County",
    city: "Charleston",
    longitude: -81.6326,
    latitude: 38.3498,
  },
  {
    slug: "wisconsin",
    name: "Wisconsin",
    code: "WI",
    metro: "Milwaukee–Waukesha",
    county: "Milwaukee County",
    city: "Milwaukee",
    longitude: -87.9065,
    latitude: 43.0389,
  },
  {
    slug: "wyoming",
    name: "Wyoming",
    code: "WY",
    metro: "Cheyenne",
    county: "Laramie County",
    city: "Cheyenne",
    longitude: -104.8202,
    latitude: 41.14,
  },
] as const;

const regionalGeographies: RegionalGeography[] = [
  ...coreRegionalGeographies,
  ...stateMarketSeeds.map((seed) => ({
    slug: seed.slug,
    location: `${seed.city}, ${seed.code}`,
    regionName: seed.name,
    state: seed.name,
    metro: seed.metro,
    county: seed.county,
    city: seed.city,
  })),
];

const eventTypes = [
  "Private-company acquisition",
  "Public share sale",
  "Founder secondary",
  "Special dividend",
  "Recapitalization",
  "Proposed public share sale",
];

const roles = [
  "Founder & CEO",
  "Co-founder",
  "Executive chair",
  "Founder & director",
  "Managing partner",
  "Chief scientific officer",
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const people: Person[] = Array.from({ length: 240 }, (_, index) => {
  const first = firstNames[index % firstNames.length];
  const nameRound = Math.floor(index / firstNames.length);
  const last =
    lastNames[
      index < firstNames.length
        ? index
        : (index + nameRound * 7) % lastNames.length
    ];
  const name = `${first} ${last}`;
  const median = 18_000_000 + ((index * 37) % 145) * 1_000_000;
  const createdMedian = Math.round(median * (1.35 + (index % 4) * 0.12));
  const deployedMedian = Math.round(
    createdMedian * (0.12 + (index % 5) * 0.035),
  );
  const primaryGeography =
    index === 6
      ? regionalGeographies[1]
      : regionalGeographies[index % regionalGeographies.length];
  const eventGeography =
    index % 4 === 0
      ? regionalGeographies[(index + 1) % regionalGeographies.length]
      : primaryGeography;
  const investmentGeography =
    index % 5 === 0
      ? regionalGeographies[1]
      : regionalGeographies[(index * 3 + 2) % regionalGeographies.length];
  const relationshipDate = new Date(Date.UTC(2026, 5, 24 - (index % 20)))
    .toISOString()
    .slice(0, 10);
  const geographicRelationships: GeographicRelationship[] = [
    {
      type: "primary_economic_location",
      regionSlug: primaryGeography.slug,
      label: `Primary economic location is ${primaryGeography.city}`,
      evidenceId: `geo_primary_${index + 1}`,
      occurredAt: relationshipDate,
    },
    {
      type: "current_company",
      regionSlug: primaryGeography.slug,
      label: `${organizations[index % organizations.length]} operates from ${primaryGeography.city}`,
      evidenceId: `geo_company_${index + 1}`,
      occurredAt: relationshipDate,
    },
    {
      type: "liquidity_event",
      regionSlug: eventGeography.slug,
      label: `Qualifying liquidity event originated in ${eventGeography.regionName}`,
      evidenceId: `geo_event_${index + 1}`,
      occurredAt: relationshipDate,
    },
    {
      type: "investment_activity",
      regionSlug: investmentGeography.slug,
      label: `Known investment in ${investmentGeography.regionName}`,
      evidenceId: `geo_investment_${index + 1}`,
      occurredAt: relationshipDate,
    },
  ];
  if (index % 3 === 0) {
    geographicRelationships.push({
      type: "board_affiliation",
      regionSlug:
        regionalGeographies[(index + 3) % regionalGeographies.length].slug,
      label: `Board relationship in ${
        regionalGeographies[(index + 3) % regionalGeographies.length].regionName
      }`,
      evidenceId: `geo_board_${index + 1}`,
      occurredAt: relationshipDate,
    });
  }
  if (index % 4 === 1) {
    geographicRelationships.push({
      type: "former_company",
      regionSlug:
        regionalGeographies[(index + 5) % regionalGeographies.length].slug,
      label: `Former company connection to ${
        regionalGeographies[(index + 5) % regionalGeographies.length].regionName
      }`,
      evidenceId: `geo_former_${index + 1}`,
      occurredAt: relationshipDate,
    });
  }
  if (index % 6 === 0) {
    geographicRelationships.push({
      type: "philanthropic_activity",
      regionSlug: primaryGeography.slug,
      label: `Documented philanthropic activity in ${primaryGeography.regionName}`,
      evidenceId: `geo_philanthropy_${index + 1}`,
      occurredAt: relationshipDate,
    });
  }
  return {
    id: `person_${String(index + 1).padStart(3, "0")}`,
    slug: slugify(name),
    name,
    initials: `${first[0]}${last[0]}`,
    role: roles[index % roles.length],
    organization: organizations[index % organizations.length],
    industry:
      index === 6 ? "Biotechnology" : industries[index % industries.length],
    location: primaryGeography.location,
    eventType: eventTypes[index % eventTypes.length],
    eventDate: new Date(Date.UTC(2026, 6, 22 - (index % 18)))
      .toISOString()
      .slice(0, 10),
    remaining: {
      low: Math.round(median * 0.72),
      median,
      high: Math.round(median * 1.36),
    },
    created: {
      low: Math.round(createdMedian * 0.78),
      median: createdMedian,
      high: Math.round(createdMedian * 1.28),
    },
    deployed: {
      low: Math.round(deployedMedian * 0.82),
      median: deployedMedian,
      high: Math.round(deployedMedian * 1.22),
    },
    confidence: 67 + ((index * 7) % 29),
    radar: 61 + ((index * 11) % 37),
    momentum: -4 + ((index * 9) % 23),
    sourceCount: 3 + (index % 12),
    status:
      index === 0
        ? "Claimed"
        : index % 13 === 0
          ? "Pending review"
          : index % 11 === 0
            ? "Claimed"
            : "Published",
    primaryRegionSlug: primaryGeography.slug,
    eventRegionSlug: eventGeography.slug,
    geographicRelationships,
  };
});

export const organizationProfiles: OrganizationProfile[] = organizations.map(
  (name, index) => {
    const relatedPeople = people.filter(
      (person) => person.organization === name,
    );
    const regionSlugs = Array.from(
      new Set(
        relatedPeople.flatMap((person) => [
          person.primaryRegionSlug,
          person.eventRegionSlug,
          ...person.geographicRelationships
            .filter(
              (relationship) =>
                relationship.type === "investment_activity" ||
                relationship.type === "current_company",
            )
            .map((relationship) => relationship.regionSlug),
        ]),
      ),
    );
    return {
      id: `org_${String(index + 1).padStart(3, "0")}`,
      slug: slugify(name),
      name,
      type: [
        "private_company",
        "acquirer",
        "investment_firm",
        "foundation",
        "family_office",
      ][index % 5],
      industry:
        relatedPeople[0]?.industry ?? industries[index % industries.length],
      publicClassification: index % 4 === 0 ? "public" : "private",
      regionSlugs:
        regionSlugs.length > 1
          ? regionSlugs
          : [
              regionalGeographies[index % regionalGeographies.length].slug,
              regionalGeographies[(index + 1) % regionalGeographies.length]
                .slug,
            ],
    };
  },
);

const eventStatuses: LiquidityEvent["status"][] = [
  "Completed",
  "Completed",
  "Announced",
  "Proposed",
  "Completed",
  "Withdrawn",
];

export const events: LiquidityEvent[] = Array.from(
  { length: 720 },
  (_, index) => {
    const person = people[index % people.length];
    const geography =
      regionalGeographies.find(
        (record) => record.slug === person.eventRegionSlug,
      ) ?? regionalGeographies[index % regionalGeographies.length];
    const organization = organizationProfiles.find(
      (record) => record.name === person.organization,
    )!;
    const median = Math.round(
      person.created.median * (0.48 + (index % 6) * 0.08),
    );
    const status = eventStatuses[index % eventStatuses.length];
    return {
      id: `event_${String(index + 1).padStart(3, "0")}`,
      person: person.name,
      organization: person.organization,
      type: eventTypes[index % eventTypes.length],
      place: geography.location,
      date: new Date(Date.UTC(2026, 6, 24 - (index % 45)))
        .toISOString()
        .slice(0, 10),
      sourceDate: new Date(Date.UTC(2026, 6, 24 - (index % 42)))
        .toISOString()
        .slice(0, 10),
      gross: {
        low: status === "Proposed" ? Math.round(median * 0.9) : median,
        median,
        high: status === "Proposed" ? Math.round(median * 1.12) : median,
      },
      net: {
        low: Math.round(median * 0.54),
        median: Math.round(median * 0.65),
        high: Math.round(median * 0.76),
      },
      confidence:
        status === "Completed" ? 82 + (index % 14) : 61 + (index % 19),
      status,
      classification:
        index % 3 === 0
          ? "observed"
          : index % 3 === 1
            ? "calculated"
            : "estimated",
      source:
        index % 3 === 0
          ? `SEC Form 4 · Accession 2026-${String(index + 1042).padStart(6, "0")}`
          : index % 3 === 1
            ? "Company transaction announcement"
            : "Analyst-reviewed public source set",
      explanation:
        status === "Proposed"
          ? "Proposed disposition. Completion is not assumed until later evidence is matched."
          : "Estimated net proceeds reflect observed transaction terms and explicit tax, fee, and holdback ranges.",
      personId: person.id,
      personSlug: person.slug,
      personRole: person.role,
      organizationSlug: organization.slug,
      organizationClass: organization.publicClassification,
      regionSlug: geography.slug,
      regionName: geography.regionName,
      state: geography.state,
      metro: geography.metro,
      county: geography.county,
      city: geography.city,
      industry: person.industry,
      naics:
        person.industry === "Biotechnology"
          ? "541714"
          : ["541511", "325414", "221114", "334519"][index % 4],
      category: index % 7 === 0 ? "deployment" : "liquidity",
      description:
        index % 7 === 0
          ? `${person.name} directed a documented investment from ${person.organization} into ${geography.regionName}.`
          : `${person.organization} generated a qualifying ${eventTypes[index % eventTypes.length].toLowerCase()} associated with ${person.name} in ${geography.regionName}.`,
    };
  },
);

type RegionMetricSeed = readonly [
  slug: string,
  name: string,
  code: string,
  metro: string,
  county: string,
  city: string,
  type: Region["type"],
  hierarchy: readonly string[],
  longitude: number,
  latitude: number,
];

const regionMetricSeeds: RegionMetricSeed[] = [
  [
    "washington-arlington-alexandria",
    "Washington–Arlington–Alexandria Metro",
    "DC",
    "Washington–Arlington–Alexandria",
    "",
    "Washington",
    "metro",
    ["washington-arlington-alexandria"],
    -77.04,
    38.91,
  ],
  [
    "montgomery-county-md",
    "Montgomery County, Maryland",
    "MD",
    "Washington–Arlington–Alexandria",
    "Montgomery County",
    "Rockville",
    "county",
    ["montgomery-county-md", "maryland", "washington-arlington-alexandria"],
    -77.15,
    39.08,
  ],
  [
    "maryland",
    "Maryland",
    "MD",
    "Baltimore–Columbia–Towson",
    "",
    "Baltimore",
    "state",
    ["maryland"],
    -76.64,
    39.05,
  ],
  [
    "northern-virginia",
    "Northern Virginia",
    "VA",
    "Washington–Arlington–Alexandria",
    "Arlington County",
    "Arlington",
    "subregion",
    ["northern-virginia", "washington-arlington-alexandria"],
    -77.11,
    38.88,
  ],
  [
    "new-york",
    "New York Metro",
    "NY",
    "New York–Newark–Jersey City",
    "New York County",
    "New York",
    "metro",
    ["new-york"],
    -74.01,
    40.71,
  ],
  [
    "new-orleans-metairie",
    "New Orleans–Metairie Metro",
    "LA",
    "New Orleans–Metairie",
    "Orleans Parish",
    "New Orleans",
    "metro",
    ["new-orleans-metairie"],
    -90.07,
    29.95,
  ],
  [
    "boston-cambridge",
    "Boston–Cambridge Metro",
    "MA",
    "Boston–Cambridge–Newton",
    "Suffolk County",
    "Boston",
    "metro",
    ["boston-cambridge"],
    -71.06,
    42.36,
  ],
  [
    "austin-round-rock",
    "Austin–Round Rock Metro",
    "TX",
    "Austin–Round Rock",
    "Travis County",
    "Austin",
    "metro",
    ["austin-round-rock"],
    -97.74,
    30.27,
  ],
  [
    "raleigh-durham",
    "Raleigh–Durham",
    "NC",
    "Raleigh–Cary",
    "Wake County",
    "Raleigh",
    "metro",
    ["raleigh-durham"],
    -78.64,
    35.78,
  ],
  [
    "san-diego-carlsbad",
    "San Diego–Carlsbad",
    "CA",
    "San Diego–Chula Vista–Carlsbad",
    "San Diego County",
    "San Diego",
    "metro",
    ["san-diego-carlsbad"],
    -117.16,
    32.72,
  ],
  ...stateMarketSeeds.map((seed): RegionMetricSeed => [
    seed.slug,
    seed.name,
    seed.code,
    seed.metro,
    seed.county,
    seed.city,
    "state",
    [seed.slug],
    seed.longitude,
    seed.latitude,
  ]),
];

export const regions: Region[] = regionMetricSeeds.map((seed, index) => {
  const [
    slug,
    name,
    code,
    metro,
    county,
    city,
    type,
    hierarchy,
    longitude,
    latitude,
  ] = seed;
  const created = 1_420_000_000 + ((index * 467) % 2900) * 1_000_000;
  const controlled = Math.round(created * (0.76 + (index % 4) * 0.08));
  const deployed = Math.round(created * (0.23 + (index % 5) * 0.035));
  const retained = 0.55 + (index % 6) * 0.035;
  return {
    slug,
    name,
    code,
    metro,
    county,
    city,
    type,
    hierarchy: [...hierarchy],
    coordinates: [longitude, latitude],
    created,
    controlled,
    deployed,
    retained,
    leakage: 1 - retained,
    attraction: 0.48 + (index % 7) * 0.035,
    people: 18 + ((index * 7) % 44),
    eventCount: 14 + ((index * 11) % 39),
    highConfidencePeople: 8 + ((index * 5) % 21),
    momentum: 7 + ((index * 9) % 27),
    industries: [
      { name: "Biotechnology", share: 0.31 - (index % 3) * 0.03 },
      { name: "Enterprise Software", share: 0.27 + (index % 2) * 0.04 },
      { name: "Healthcare", share: 0.22 },
      { name: "Advanced Manufacturing", share: 0.2 },
    ],
  };
});

export const evidence = [
  {
    label: "Transaction value",
    value: "$410M cash consideration",
    kind: "observed",
    source: "Company merger announcement",
    excerpt:
      "The transaction provides for total cash consideration of approximately $410 million, subject to customary adjustments.",
  },
  {
    label: "Founder ownership",
    value: "18%–27% at close",
    kind: "estimated",
    source: "Financing history + beneficial ownership filing",
    excerpt:
      "Ownership range reflects disclosed early holdings, known financing rounds, and modeled dilution through the final preferred round.",
  },
  {
    label: "Net transaction proceeds",
    value: "$63M–$112M",
    kind: "calculated",
    source: "Model LR-EXIT 2.4",
    excerpt:
      "Calculated from equity value, ownership distribution, cash consideration, fees, escrow, rollover equity, and tax scenarios.",
  },
  {
    label: "Unobserved deployment",
    value: "$4M–$16M",
    kind: "inferred",
    source: "Remaining-liquidity model",
    excerpt:
      "Model assumption based on elapsed time, investor activity, entity formations, and the share of deployment events with public documentation.",
  },
] as const;

export const savedSearches = [
  {
    name: "Southeast healthcare exits",
    results: 18,
    updated: "12 min ago",
    owner: "You",
  },
  {
    name: "New England founders · $25M+",
    results: 27,
    updated: "43 min ago",
    owner: "You",
  },
  {
    name: "Climate infrastructure investors",
    results: 34,
    updated: "2 hr ago",
    owner: "Strategy team",
  },
  {
    name: "Recent public sales · high confidence",
    results: 41,
    updated: "Today",
    owner: "Research",
  },
];

export const alerts = [
  {
    name: "New $25M+ event in Raleigh–Durham",
    frequency: "Immediate",
    last: "2 delivered",
    active: true,
  },
  {
    name: "Healthcare match score above 80",
    frequency: "Daily digest",
    last: "6 delivered",
    active: true,
  },
  {
    name: "Profile change: Amara Voss",
    frequency: "Immediate",
    last: "No changes",
    active: true,
  },
  {
    name: "New family office formations",
    frequency: "Weekly digest",
    last: "Friday",
    active: false,
  },
];

export const jobs = [
  {
    name: "SEC daily discovery",
    status: "Healthy",
    last: "4 min ago",
    duration: "18s",
    records: 127,
  },
  {
    name: "Form 4 parser",
    status: "Healthy",
    last: "7 min ago",
    duration: "31s",
    records: 84,
  },
  {
    name: "Estimate generation",
    status: "Running",
    last: "Now",
    duration: "2m 14s",
    records: 312,
  },
  {
    name: "Regional aggregation",
    status: "Healthy",
    last: "22 min ago",
    duration: "47s",
    records: 20,
  },
  {
    name: "Alert evaluation",
    status: "Healthy",
    last: "8 min ago",
    duration: "12s",
    records: 66,
  },
  {
    name: "Feed polling",
    status: "Needs attention",
    last: "31 min ago",
    duration: "9s",
    records: 11,
  },
];

export const reviewQueue = events
  .filter((event) => event.confidence < 80 || event.status !== "Completed")
  .slice(0, 9)
  .map((event, index) => ({
    ...event,
    reviewType:
      index % 3 === 0
        ? "Private transaction"
        : index % 3 === 1
          ? "Identity match"
          : "Conflicting evidence",
    age: `${18 + index * 7}h`,
    assigned: index % 2 === 0 ? "M. Chen" : "Unassigned",
  }));
