"""Gujarat track: every district is known, and the six schemes added from official pages decide
eligibility the way their sources say - including saying no when they should."""

import pytest

from app.modules.eligibility.loader import invalidate_ruleset, load_rule_files
from app.modules.routing.districts import DISTRICTS
from app.seed.partners import seed_partners
from app.seed.schemes import seed_schemes

NEW_SCHEMES = {"STANDUP_INDIA", "PM_VISHWAKARMA", "NSTFDC_TERM_LOAN", "NSTFDC_AMSY", "GJ_MAHILA_UTKARSH", "MUDRA_SHISHU"}

# A first-time woman entrepreneur in Gandhinagar - the demo script's applicant (fictional).
MEENA = {
    "age": 29, "gender": "female", "social_category": "obc", "has_disability": False, "state_code": "GJ",
    "district_code": "GJ-GNR", "pincode": "382010", "annual_family_income_paise": 150_000_00,
    "education_level": "secondary", "business_type": "tailoring", "project_cost_paise": 90_000_00,
    "loan_needed_paise": 80_000_00, "existing_loans": False, "shg_member": False,
}


@pytest.fixture(scope="module", autouse=True)
async def _seeded():  # type: ignore[no-untyped-def]
    from app.db.session import get_sessionmaker

    async with get_sessionmaker()() as session:
        await seed_schemes(session)
        await seed_partners(session)
        await session.commit()
    invalidate_ruleset()
    yield


async def _eligible(client, facts: dict) -> set[str]:  # type: ignore[no-untyped-def]
    res = await client.post("/v1/eligibility/evaluate", json={"applicant": facts})
    assert res.status_code == 200, res.text
    return set(res.json()["eligible"])


def test_all_gujarat_districts_are_known() -> None:
    gujarat = {d.code for d in DISTRICTS if d.state_code == "GJ"}
    # 33 on the state portal, plus Vav-Tharad (flagged for verification)
    assert len(gujarat) == 34 and {"GJ-GNR", "GJ-KUT", "GJ-DAN", "GJ-VTH"} <= gujarat
    assert len({d.code for d in DISTRICTS}) == len(DISTRICTS)  # no duplicate codes


def test_new_schemes_carry_today_s_source() -> None:
    docs = {d["scheme_code"]: d for d in load_rule_files()}
    assert NEW_SCHEMES <= set(docs)
    for code in NEW_SCHEMES:
        assert docs[code]["source_url"].startswith("https://") and str(docs[code]["verified_on"]) == "2026-10-11"


async def test_gandhinagar_woman_tailor(client) -> None:  # type: ignore[no-untyped-def]
    ok = await _eligible(client, MEENA)
    assert "GJ_MAHILA_UTKARSH" in ok  # woman, Gujarat, 18+, schooling, Rs 80,000 <= Rs 1 lakh
    assert "PM_VISHWAKARMA" in ok  # tailor, Rs 80,000 <= Rs 1 lakh first tranche
    assert "STANDUP_INDIA" not in ok  # starts at Rs 10 lakh
    assert "MUDRA_SHISHU" not in ok  # Shishu tops out at Rs 50,000
    assert not ok & {"NSTFDC_TERM_LOAN", "NSTFDC_AMSY"}  # ST only


async def test_mahila_utkarsh_says_no_when_it_should(client) -> None:  # type: ignore[no-untyped-def]
    assert "GJ_MAHILA_UTKARSH" not in await _eligible(client, {**MEENA, "gender": "male"})
    assert "GJ_MAHILA_UTKARSH" not in await _eligible(client, {**MEENA, "state_code": "RJ", "district_code": "RJ-BAR"})
    assert "GJ_MAHILA_UTKARSH" not in await _eligible(client, {**MEENA, "education_level": "primary"})
    assert "GJ_MAHILA_UTKARSH" not in await _eligible(client, {**MEENA, "loan_needed_paise": 150_000_00})


async def test_standup_india(client) -> None:  # type: ignore[no-untyped-def]
    big = {**MEENA, "project_cost_paise": 15_00_000_00, "loan_needed_paise": 12_00_000_00}
    assert "STANDUP_INDIA" in await _eligible(client, big)  # woman, Rs 12 lakh
    sc_man = {**big, "gender": "male", "social_category": "sc"}
    assert "STANDUP_INDIA" in await _eligible(client, sc_man)
    assert "STANDUP_INDIA" not in await _eligible(client, {**sc_man, "social_category": "obc"})


async def test_nstfdc_for_scheduled_tribes(client) -> None:  # type: ignore[no-untyped-def]
    st_woman = {**MEENA, "social_category": "st", "district_code": "GJ-DAH", "project_cost_paise": 1_50_000_00,
                "loan_needed_paise": 1_20_000_00}
    ok = await _eligible(client, st_woman)
    assert {"NSTFDC_TERM_LOAN", "NSTFDC_AMSY"} <= ok
    assert "NSTFDC_AMSY" not in await _eligible(client, {**st_woman, "gender": "male"})
    rich = await _eligible(client, {**st_woman, "annual_family_income_paise": 3_50_000_00})
    assert not rich & {"NSTFDC_TERM_LOAN", "NSTFDC_AMSY"}  # above the Rs 3 lakh family income limit


async def test_vishwakarma_and_shishu(client) -> None:  # type: ignore[no-untyped-def]
    assert "PM_VISHWAKARMA" not in await _eligible(client, {**MEENA, "business_type": "retail_shop"})
    small_shop = {**MEENA, "business_type": "retail_shop", "loan_needed_paise": 40_000_00, "project_cost_paise": 45_000_00}
    assert "MUDRA_SHISHU" in await _eligible(client, small_shop)


async def test_gandhinagar_has_lenders(client) -> None:  # type: ignore[no-untyped-def]
    res = await client.get("/v1/partners/nearby", params={"lat": 23.2156, "lng": 72.6369, "scheme": "GJ_MAHILA_UTKARSH",
                                                          "category": "obc"})
    assert res.status_code == 200, res.text
    assert res.json()["partners"], "no demo lender near Gandhinagar"


MEENA_SAYS = [
    "મારું નામ મીના પટેલ છે, મારી ઉંમર ઓગણત્રીસ વર્ષ છે, હું ગાંધીનગર જિલ્લામાં રહું છું.",
    "હું સ્ત્રી છું, અન્ય પછાત વર્ગમાંથી છું, કોઈ વિકલાંગતા નથી.",
    "મારે સિલાઈનું કામ શરૂ કરવું છે, કુલ ખર્ચ નેવું હજાર રૂપિયા, અને લોન એંસી હજાર જોઈએ.",
    "ઘરની વર્ષની આવક દોઢ લાખ છે, હું દસ ધોરણ સુધી ભણી છું.",
    "હું સખી મંડળની સભ્ય નથી, અને મારી પાસે બીજી કોઈ લોન નથી.",
    "હા, બરાબર છે.",
]


async def test_gujarati_voice_intake_end_to_end(client) -> None:  # type: ignore[no-untyped-def]
    # what the browser recogniser would hand us, turn by turn; every reply must be Gujarati
    import re

    turn = (await client.post("/v1/voice/sessions", json={"lang": "gu"})).json()
    replies = [turn["reply_text"]]
    for line in MEENA_SAYS:
        res = await client.post(f"/v1/voice/sessions/{turn['session_id']}/utterance", data={"text": line, "source": "browser"})
        assert res.status_code == 200, res.text
        turn = res.json()
        replies.append(turn["reply_text"])
    for reply in replies:
        assert re.search(r"[઀-૿]", reply), reply  # Gujarati script
        assert "{" not in reply, reply  # no unfilled template slots
    values = {k: v["value"] for k, v in turn["slots"].items()}
    assert values["district_code"] == "GJ-GNR" and values["age"] == 29 and values["gender"] == "female"
    assert values["social_category"] == "obc" and values["business_type"] == "tailoring"
    assert values["project_cost_paise"] == 90_000_00 and values["loan_needed_paise"] == 80_000_00
    assert values["annual_family_income_paise"] == 150_000_00 and values["education_level"] == "secondary"
    assert turn["state"] == "done" and turn["filled"] == turn["total"]


def test_name_that_matches_is_never_called_a_mismatch() -> None:
    # Walkthrough bug: the passbook name matched 100% but had nothing else to tie it to the
    # person, and the app said "doesn't match your other papers". It now says what's true.
    from app.modules.documents.readiness import Applicant, DocView, check_readiness

    required = [{"type": t, "required": True} for t in ("aadhaar", "marksheet", "bank_passbook")]
    docs = {
        "aadhaar": DocView("aadhaar", {"name": "Jyoti Vaghela", "dob": "1997-06-18", "aadhaar_last4": "7613"}, 0.95, [], "upload"),
        "marksheet": DocView("marksheet", {"name": "Jyoti Vaghela", "dob": "1997-06-18"}, 0.95, [], "upload"),
        "bank_passbook": DocView("bank_passbook", {"name": "JYOTI VAGHELA"}, 0.95, [], "upload"),
    }
    out = check_readiness(required, docs, Applicant("Jyoti Vaghela", None, None, 90_000_00), 70)
    keys = {(f["key"], f["params"].get("doc")) for f in out["fixes"]}
    assert ("docs.fix.name_mismatch", "bank_passbook") not in keys
    assert ("docs.fix.name_unconfirmed", "bank_passbook") in keys
    # with no typed DOB, the Aadhaar's DOB anchors the marksheet
    assert out["name_matches"]["marksheet"]["matched"] is True
    docs["bank_passbook"] = DocView("bank_passbook", {"name": "Priya Shah"}, 0.95, [], "upload")
    out = check_readiness(required, docs, Applicant("Jyoti Vaghela", None, None, 90_000_00), 70)
    assert ("docs.fix.name_mismatch", "bank_passbook") in {(f["key"], f["params"].get("doc")) for f in out["fixes"]}


def test_readback_skips_the_holiday_when_there_is_none() -> None:
    from app.core.i18n import t

    plain = t("gu", "send.readback_summary_no_holiday", name="જ્યોતિ", scheme="યોજના", amount="80 હજાર", emi="1,333",
              tenure=60, partner="બેંક")
    assert "રાહત" not in plain and "{" not in plain and "60" in plain
