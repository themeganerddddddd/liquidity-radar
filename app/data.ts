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
};

export type Region = {
  name: string;
  code: string;
  metro: string;
  coordinates: [number, number];
  created: number;
  controlled: number;
  deployed: number;
  retained: number;
  leakage: number;
  attraction: number;
  people: number;
  momentum: number;
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

const places = [
  "Boston, MA",
  "Austin, TX",
  "Raleigh, NC",
  "Denver, CO",
  "Seattle, WA",
  "Nashville, TN",
  "San Diego, CA",
  "Atlanta, GA",
  "Chicago, IL",
  "New York, NY",
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

export const people: Person[] = firstNames.map((first, index) => {
  const name = `${first} ${lastNames[index]}`;
  const median = 18_000_000 + ((index * 37) % 145) * 1_000_000;
  const createdMedian = Math.round(median * (1.35 + (index % 4) * 0.12));
  const deployedMedian = Math.round(
    createdMedian * (0.12 + (index % 5) * 0.035),
  );
  return {
    id: `person_${String(index + 1).padStart(3, "0")}`,
    slug: slugify(name),
    name,
    initials: `${first[0]}${lastNames[index][0]}`,
    role: roles[index % roles.length],
    organization: organizations[index % organizations.length],
    industry: industries[index % industries.length],
    location: places[index % places.length],
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
  };
});

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
    const median = Math.round(
      person.created.median * (0.48 + (index % 6) * 0.08),
    );
    const status = eventStatuses[index % eventStatuses.length];
    return {
      id: `event_${String(index + 1).padStart(3, "0")}`,
      person: person.name,
      organization: person.organization,
      type: eventTypes[index % eventTypes.length],
      place: places[index % places.length],
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
    };
  },
);

export const regions: Region[] = [
  {
    name: "Massachusetts",
    code: "MA",
    metro: "Boston–Cambridge",
    coordinates: [-71.06, 42.36],
    created: 4_280_000_000,
    controlled: 3_460_000_000,
    deployed: 1_140_000_000,
    retained: 0.71,
    leakage: 0.29,
    attraction: 0.63,
    people: 46,
    momentum: 18,
  },
  {
    name: "Texas",
    code: "TX",
    metro: "Austin–Round Rock",
    coordinates: [-97.74, 30.27],
    created: 3_820_000_000,
    controlled: 3_090_000_000,
    deployed: 1_320_000_000,
    retained: 0.64,
    leakage: 0.36,
    attraction: 0.58,
    people: 52,
    momentum: 24,
  },
  {
    name: "California",
    code: "CA",
    metro: "San Diego–Carlsbad",
    coordinates: [-117.16, 32.72],
    created: 3_440_000_000,
    controlled: 2_760_000_000,
    deployed: 1_480_000_000,
    retained: 0.57,
    leakage: 0.43,
    attraction: 0.67,
    people: 61,
    momentum: 9,
  },
  {
    name: "North Carolina",
    code: "NC",
    metro: "Raleigh–Durham",
    coordinates: [-78.64, 35.78],
    created: 2_680_000_000,
    controlled: 2_210_000_000,
    deployed: 880_000_000,
    retained: 0.73,
    leakage: 0.27,
    attraction: 0.52,
    people: 38,
    momentum: 31,
  },
  {
    name: "Colorado",
    code: "CO",
    metro: "Denver–Aurora",
    coordinates: [-104.99, 39.74],
    created: 2_140_000_000,
    controlled: 1_940_000_000,
    deployed: 720_000_000,
    retained: 0.66,
    leakage: 0.34,
    attraction: 0.61,
    people: 31,
    momentum: 16,
  },
  {
    name: "Washington",
    code: "WA",
    metro: "Seattle–Tacoma",
    coordinates: [-122.33, 47.61],
    created: 1_980_000_000,
    controlled: 1_720_000_000,
    deployed: 690_000_000,
    retained: 0.59,
    leakage: 0.41,
    attraction: 0.56,
    people: 29,
    momentum: 12,
  },
  {
    name: "Tennessee",
    code: "TN",
    metro: "Nashville",
    coordinates: [-86.78, 36.16],
    created: 1_420_000_000,
    controlled: 1_210_000_000,
    deployed: 410_000_000,
    retained: 0.76,
    leakage: 0.24,
    attraction: 0.48,
    people: 21,
    momentum: 27,
  },
  {
    name: "Georgia",
    code: "GA",
    metro: "Atlanta",
    coordinates: [-84.39, 33.75],
    created: 1_680_000_000,
    controlled: 1_360_000_000,
    deployed: 520_000_000,
    retained: 0.68,
    leakage: 0.32,
    attraction: 0.54,
    people: 27,
    momentum: 19,
  },
  {
    name: "Illinois",
    code: "IL",
    metro: "Chicago",
    coordinates: [-87.63, 41.88],
    created: 1_830_000_000,
    controlled: 1_510_000_000,
    deployed: 610_000_000,
    retained: 0.62,
    leakage: 0.38,
    attraction: 0.57,
    people: 33,
    momentum: 7,
  },
  {
    name: "New York",
    code: "NY",
    metro: "New York–Newark",
    coordinates: [-74.01, 40.71],
    created: 3_120_000_000,
    controlled: 3_740_000_000,
    deployed: 1_720_000_000,
    retained: 0.55,
    leakage: 0.45,
    attraction: 0.72,
    people: 58,
    momentum: 14,
  },
];

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
