# Geographic methodology

Creation location is the company or asset geography at the event. Control location is the person’s current public economic geography. Deployment location is the known recipient geography. Affinity is a documented relationship, not residence.

Regional creation, control, and destination totals are calculated separately to prevent double counting. Retention and leakage are based only on known deployment. No unknown activity is treated as zero. Public geography stops at city, county, metro, state, or country.

## Region-relative affinity

Affinity is calculated against the region selected in the URL, then the user's
recent region, then the workspace home region. The transparent base weights are
35 points for primary economic location, 20 for current company, 15 each for a
liquidity event or known investment, 10 for a family office, 8 each for a former
company or philanthropy, 5 for a board relationship, 4 for education, and up to
5 for another documented affinity. Repeated relationships of one type receive
diminishing multipliers of 1, 0.5, and 0.25 and are capped at 1.75 times that
component's base weight. The final score is normalized to 0–100 and reports its
calculation date, evidence count, component breakdown, and supporting reasons.
