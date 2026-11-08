"""People an account books care for: the account holder, parents, children and so on."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, status
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlalchemy import select

from khidmat_api.core.database import SessionDep
from khidmat_api.core.enums import Gender
from khidmat_api.modules.identity.dependencies import PatientUserDep
from khidmat_api.modules.patients.models import Patient, PatientRelation

router = APIRouter(prefix="/patients", tags=["patients"])


class PatientCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    gender: Gender
    birth_year: Annotated[int, Field(ge=1900, le=2100)] | None = None
    relation: PatientRelation = PatientRelation.SELF


class PatientView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    gender: Gender
    birth_year: int | None
    relation: PatientRelation


@router.get("", summary="People you book for")
async def my_patients(user: PatientUserDep, session: SessionDep) -> list[PatientView]:
    rows = await session.scalars(
        select(Patient).where(Patient.owner_id == user.id).order_by(Patient.created_at)
    )
    return [PatientView.model_validate(row) for row in rows]


@router.post("", status_code=status.HTTP_201_CREATED, summary="Add a person you book for")
async def add_patient(
    payload: PatientCreate, user: PatientUserDep, session: SessionDep
) -> PatientView:
    patient = Patient(owner_id=user.id, **payload.model_dump())
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return PatientView.model_validate(patient)
