"""Policy dashboard: synthetic data is labelled and self-consistent, and the API only ever hands
out aggregates with small cells suppressed."""

from collections import Counter

import pytest

from app.config import get_settings
from app.modules.insights.service import suppress
from app.seed.partners import seed_partners
from app.seed.schemes import seed_schemes
from app.seed.synthetic import COUNT, DECIDED, generate, seed_synthetic
from app.seed.users import seed_users
from tests.conftest import login

POLICY_DESK = "9000000040"


@pytest.fixture(scope="module", autouse=True)
async def _seeded():  # type: ignore[no-untyped-def]
    from app.db.session import get_sessionmaker

    async with get_sessionmaker()() as session:
        await seed_schemes(session)
        await seed_partners(session)
        await seed_users(session)
        await seed_synthetic(session)
        await session.commit()
        assert "already there" in await seed_synthetic(session)  # idempotent
    yield


def test_synthetic_rows_are_deterministic_and_consistent() -> None:
    rows = generate()
    assert len(rows) == COUNT == 2_000
    assert [r.district_code for r in rows[:20]] == [r.district_code for r in generate()[:20]]
    assert all(r.batch == "demo-v1" for r in rows)
    for r in rows:
        assert (r.decided_at is not None) == (r.status in DECIDED)
        if r.decided_at:
            assert r.decided_at >= r.submitted_at
        if r.scheme_code.startswith("NSFDC"):
            assert r.social_category == "sc"
        if r.scheme_code in ("NSTFDC_AMSY", "GJ_MAHILA_UTKARSH", "NSFDC_MAHILA_SAMRIDHI"):
            assert r.gender == "female"
        if r.scheme_code == "GJ_MAHILA_UTKARSH":
            assert r.state_code == "GJ"
    assert sum(r.state_code == "GJ" for r in rows) > COUNT * 0.6  # Gujarat track


def test_small_cells_are_hidden_and_cannot_be_subtracted_back() -> None:
    assert suppress(Counter({"a": 40, "b": 12, "c": 3}), 10) == {"a": 40, "b": None, "c": None}  # complementary
    assert suppress(Counter({"a": 40, "b": 12, "c": 3, "d": 2}), 10) == {"a": 40, "b": 12, "c": None, "d": None}
    assert suppress(Counter({"a": 9}), 10) == {"a": None}


async def test_only_the_policy_desk_sees_it(client) -> None:  # type: ignore[no-untyped-def]
    assert (await client.get("/v1/insights/summary")).status_code == 401
    citizen = await login(client, "9000000001")
    assert (await client.get("/v1/insights/summary", headers=citizen)).status_code == 403


async def test_summary_is_aggregates_only_and_labelled(client) -> None:  # type: ignore[no-untyped-def]
    desk = await login(client, POLICY_DESK)
    body = (await client.get("/v1/insights/summary", headers=desk)).json()
    k = get_settings().k_anonymity_min
    assert body["includes_synthetic"] is True and body["synthetic_count"] >= COUNT
    assert body["total"] >= COUNT
    for dim in ("by_district", "by_scheme", "by_status"):
        for cell in body[dim]:
            assert cell["suppressed"] == (cell["count"] is None)
            assert cell["count"] is None or cell["count"] >= k
            assert set(cell) == {"key", "label", "count", "suppressed"}  # nothing row-level leaks
    assert 0 < body["approval_rate_bps"] < 10_000
    assert 3 <= body["median_days_to_sanction"] <= body["p75_days_to_sanction"] <= 90


async def test_filters(client) -> None:  # type: ignore[no-untyped-def]
    desk = await login(client, POLICY_DESK)
    gj = (await client.get("/v1/insights/summary", params={"state": "GJ"}, headers=desk)).json()
    assert gj["by_district"] and all(c["key"].startswith("GJ-") for c in gj["by_district"])
    assert any(c["key"] == "GJ_MAHILA_UTKARSH" for c in gj["by_scheme"])
    live = (await client.get("/v1/insights/summary", params={"source": "live"}, headers=desk)).json()
    assert live["synthetic_count"] == 0 and live["includes_synthetic"] is False
    assert (await client.get("/v1/insights/summary", params={"state": "gujarat"}, headers=desk)).status_code == 422
