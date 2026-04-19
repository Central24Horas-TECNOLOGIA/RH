from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class SuccessResponse(BaseSchema):
    success: bool = True
    message: str | None = None


class ErrorResponse(BaseSchema):
    success: bool = False
    message: str
