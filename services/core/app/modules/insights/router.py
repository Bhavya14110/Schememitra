from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Principal, require_roles
from app.db.session import get_session
from app.modules.insights import service

router = APIRouter(tags=["insights"])
Session = Annotated[AsyncSession, Depends(get_session)]
PolicyDesk = Annotated[Principal, Depends(require_roles("policy_viewer", "admin"))]


class Cell(BaseModel):
    key: str
    label: Any
    count: int | None
    suppressed: bool


class InsightsOut(BaseModel):
    k_min: int
    state: str | None
    source: Literal["all", "synthetic", "live"]
    total: int | None
    synthetic_count: int
    live_count: int
    includes_synthetic: bool
    by_district: list[Cell]
    by_scheme: list[Cell]
    by_status: list[Cell]
    approval_rate_bps: int | None
    decided_count: int | None
    median_days_to_sanction: float | None
    p75_days_to_sanction: float | None


@router.get("/v1/insights/summary", response_model=InsightsOut)
async def summary(
    session: Session,
    me: PolicyDesk,
    state: Annotated[str | None, Query(pattern=r"^[A-Z]{2}$")] = None,
    source: Literal["all", "synthetic", "live"] = "all",
) -> Any:
    """Aggregates for the policy desk. Cells under K_ANONYMITY_MIN records come back as null."""
    return await service.summary(session, state=state, source=source)
