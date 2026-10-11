"""~2,000 made-up application outcomes so the policy dashboard has something to show in a demo.

Deterministic (fixed seed and anchor date), Gujarat-heavy because that's the track we're in, and
internally consistent: SC schemes get SC applicants, women's schemes get women, and only decided
files get a decision date. None of it is real and the table name says so."""

import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import SyntheticApplication
from app.modules.routing.districts import DISTRICTS

BATCH = "demo-v1"
COUNT = 2_000
# fixed, so the same seed gives the same dashboard on every machine and in tests
ANCHOR = datetime(2026, 10, 1, tzinfo=UTC)

# (scheme, relative weight, who applies). Weights are invented to look like a plausible mix.
SCHEMES: list[tuple[str, int, list[str] | None, bool]] = [
    ("NSFDC_MICRO_CREDIT", 14, ["sc"], False),
    ("NSFDC_TERM_LOAN", 8, ["sc"], False),
    ("NSFDC_MAHILA_SAMRIDHI", 6, ["sc"], True),
    ("NBCFDC_INDIVIDUAL_LOAN", 10, ["obc"], False),
    ("NBCFDC_MICRO_FINANCE", 7, ["obc"], False),
    ("NBCFDC_NEW_SWARNIMA", 5, ["obc"], True),
    ("NSTFDC_TERM_LOAN", 6, ["st"], False),
    ("NSTFDC_AMSY", 5, ["st"], True),
    ("NSKFDC_SANITATION_ENTERPRISE", 3, ["safai_karamchari"], False),
    ("NDFDC_DIVYANG_SELF_EMPLOYMENT", 3, None, False),
    ("MUDRA_KISHOR_BANK", 9, None, False),
    ("MUDRA_SHISHU", 6, None, False),
    ("PM_VISHWAKARMA", 7, None, False),
    ("STANDUP_INDIA", 3, ["sc", "st"], False),
    ("GJ_MAHILA_UTKARSH", 8, None, True),
]
STATUSES = [("submitted", 10), ("received_by_partner", 8), ("documents_requested", 7), ("under_review", 15),
            ("sanctioned", 22), ("disbursed", 20), ("rejected", 18)]
DECIDED = {"sanctioned", "disbursed", "rejected"}
CATEGORIES = ["sc", "st", "obc", "minority", "general"]


def generate(seed: int = 51) -> list[SyntheticApplication]:
    rng = random.Random(seed)
    gujarat = [d for d in DISTRICTS if d.state_code == "GJ"]
    others = [d for d in DISTRICTS if d.state_code != "GJ"]
    # some districts are just slower at sanctioning; makes the "time to sanction" view worth looking at
    pace = {d.code: rng.uniform(0.7, 1.6) for d in DISTRICTS}
    rows = []
    for _ in range(COUNT):
        district = rng.choice(gujarat) if rng.random() < 0.75 else rng.choice(others)
        code, _, groups, women = rng.choices(SCHEMES, weights=[s[1] for s in SCHEMES])[0]
        if code == "GJ_MAHILA_UTKARSH" and district.state_code != "GJ":
            district = rng.choice(gujarat)  # a Gujarat-only scheme
        status = rng.choices([s for s, _ in STATUSES], weights=[w for _, w in STATUSES])[0]
        submitted = ANCHOR - timedelta(days=rng.uniform(0, 180))
        decided = None
        if status in DECIDED:
            days = min(90.0, rng.lognormvariate(2.6, 0.5) * pace[district.code])  # median ~13.5 days
            decided = min(ANCHOR, submitted + timedelta(days=days))
        rows.append(SyntheticApplication(
            state_code=district.state_code, district_code=district.code, scheme_code=code, status=status,
            gender="female" if women or rng.random() < 0.45 else "male",
            social_category=rng.choice(groups) if groups else rng.choice(CATEGORIES),
            submitted_at=submitted, decided_at=decided, batch=BATCH,
        ))
    return rows


async def seed_synthetic(session: AsyncSession) -> str:
    have = (await session.execute(select(func.count()).select_from(SyntheticApplication)
                                  .where(SyntheticApplication.batch == BATCH))).scalar_one()
    if have >= COUNT:
        return f"{have} synthetic applications (already there)"
    session.add_all(generate()[have:])
    return f"{COUNT} synthetic applications (clearly labelled, policy dashboard only)"
