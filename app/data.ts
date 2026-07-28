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

const regionalGeographies = [
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
] as const;

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

export const people: Person[] = firstNames.map((first, index) => {
  const name = `${first} ${lastNames[index]}`;
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
    initials: `${first[0]}${lastNames[index][0]}`,
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
  { length: 75 },
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

const regionMetricSeeds = [
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
] as const;

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
