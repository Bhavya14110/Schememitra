"""Policy dashboard numbers: aggregates only, never a row.

Any cell built from fewer than K_ANONYMITY_MIN records (default 10) is suppressed. If a dimension
would end up with exactly one hidden cell, the next smallest is hidden too, otherwise you could
get the hidden one back by subtracting the visible cells from the total. Synthetic records come
from their own table and the response always says how many of them are in the mix."""

from collections import Counter
from datetime import datetime
from statistics import median
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import Applicant, Application, SyntheticApplication
from app.modules.eligibility.loader import get_ruleset
from app.modules.routing.districts import BY_CODE

STATUS_ORDER = ["submitted", "received_by_partner", "documents_requested", "resubmitted", "under_review",
                "sanctioned", "disbursed", "rejected"]
APPROVED = {"sanctioned", "disbursed"}
DECIDED = APPROVED | {"rejected"}


def suppress(counts: Counter[str], k: int) -> dict[str, int | None]:
    """count, or None when publishing it could single someone out."""
    out: dict[str, int | None] = {key: (n if n >= k else None) for key, n in counts.items()}
    hidden = [key for key, n in out.items() if n is None]
    visible = sorted((n, key) for key, n in out.items() if n is not None)
    if len(hidden) == 1 and visible:
        out[visible[0][1]] = None  # complementary suppression
    return out


def _cells(counts: Counter[str], k: int, label: Any) -> list[dict[str, Any]]:
    shown = suppress(counts, k)
    rows = [{"key": key, "label": label(key), "count": shown[key], "suppressed": shown[key] is None} for key in counts]
    # biggest first; suppressed cells go last so the chart doesn't hint at their size
    return sorted(rows, key=lambda r: (r["count"] is None, -(r["count"] or 0), r["key"]))


def _days(a: datetime, b: datetime) -> float:
    return (b - a).total_seconds() / 86_400


async def _rows(session: AsyncSession, state: str | None, source: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if source in ("all", "synthetic"):
        q = select(SyntheticApplication)
        if state:
            q = q.where(SyntheticApplication.state_code == state)
        for s in (await session.execute(q)).scalars():
            rows.append({"source": "synthetic", "district": s.district_code, "scheme": s.scheme_code, "status": s.status,
                         "submitted": s.submitted_at, "decided": s.decided_at})
    if source in ("all", "live"):
        q = (select(Application, Applicant).join(Applicant, Applicant.id == Application.applicant_id)
             .where(Application.submitted_at.is_not(None), Application.deleted_at.is_(None)))
        if state:
            q = q.where(Applicant.state_code == state)
        for app, applicant in (await session.execute(q)).all():
            rows.append({"source": "live", "district": applicant.district_code or "unknown",
                         "scheme": (app.eligibility_trace or {}).get("scheme_code") or "unknown", "status": app.status,
                         "submitted": app.submitted_at, "decided": app.decided_at})
    return rows


async def summary(session: AsyncSession, *, state: str | None = None, source: str = "all") -> dict[str, Any]:
    k = get_settings().k_anonymity_min
    rows = await _rows(session, state, source)
    ruleset = await get_ruleset(session)

    def scheme_label(code: str) -> dict[str, str]:
        doc = ruleset.schemes[code].doc if code in ruleset.schemes else None
        return doc["name"] if doc else {"en": code}

    def district_label(code: str) -> str:
        return BY_CODE[code].name if code in BY_CODE else code

    total = len(rows)
    synthetic = sum(1 for r in rows if r["source"] == "synthetic")
    decided = [r for r in rows if r["status"] in DECIDED]
    approved = [r for r in decided if r["status"] in APPROVED]
    sanction_days = sorted(_days(r["submitted"], r["decided"]) for r in approved if r["submitted"] and r["decided"])

    return {
        "k_min": k,
        "state": state,
        "source": source,
        "total": total if total >= k else None,
        "synthetic_count": synthetic,
        "live_count": total - synthetic,
        "includes_synthetic": synthetic > 0,
        "by_district": _cells(Counter(r["district"] for r in rows), k, district_label),
        "by_scheme": _cells(Counter(r["scheme"] for r in rows), k, scheme_label),
        "by_status": sorted(_cells(Counter(r["status"] for r in rows), k, lambda s: s),
                            key=lambda r: STATUS_ORDER.index(r["key"]) if r["key"] in STATUS_ORDER else 99),
        # share of decided files that were approved; only once enough files are decided to say so
        "approval_rate_bps": round(10_000 * len(approved) / len(decided)) if len(decided) >= k else None,
        "decided_count": len(decided) if len(decided) >= k else None,
        "median_days_to_sanction": round(median(sanction_days), 1) if len(sanction_days) >= k else None,
        "p75_days_to_sanction": round(sanction_days[int(0.75 * (len(sanction_days) - 1))], 1) if len(sanction_days) >= k else None,
    }
