from __future__ import annotations

from .analytics import AnalyticsRepositoryMixin
from .analises_curriculo_ia_repository import AnalisesCurriculoIaRepositoryMixin
from .base import BaseRepository
from .candidate_sheet import CandidateSheetRepositoryMixin
from .bootstrap import (
    bootstrap_runtime_schema,
    describe_database_error,
    is_deadlock_error,
)
from .cv_analysis import CvAnalysisRepositoryMixin
from .email_inbox import EmailInboxRepositoryMixin
from .exam_analytics import ExamAnalyticsRepositoryMixin
from .communications import CommunicationRepositoryMixin
from .generated_exams import GeneratedExamRepositoryMixin
from .history import HistoryRepositoryMixin
from .interviews import InterviewRepositoryMixin
from .pipeline import PipelineRepositoryMixin
from .processes import ProcessRepositoryMixin
from .profiles import CandidateProfileRepositoryMixin
from .public_candidacy import PublicCandidacyRepositoryMixin
from .security import SecurityRepositoryMixin
from .talent_bank import TalentBankRepositoryMixin


class DatabaseRepository(
    SecurityRepositoryMixin,
    AnalisesCurriculoIaRepositoryMixin,
    HistoryRepositoryMixin,
    ProcessRepositoryMixin,
    TalentBankRepositoryMixin,
    CandidateProfileRepositoryMixin,
    CandidateSheetRepositoryMixin,
    CvAnalysisRepositoryMixin,
    EmailInboxRepositoryMixin,
    CommunicationRepositoryMixin,
    GeneratedExamRepositoryMixin,
    ExamAnalyticsRepositoryMixin,
    AnalyticsRepositoryMixin,
    PipelineRepositoryMixin,
    InterviewRepositoryMixin,
    PublicCandidacyRepositoryMixin,
    BaseRepository,
):
    """Fachada de compatibilidade que agrega os repositorios por dominio."""


__all__ = [
    "DatabaseRepository",
    "bootstrap_runtime_schema",
    "describe_database_error",
    "is_deadlock_error",
]
