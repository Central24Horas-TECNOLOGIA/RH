from __future__ import annotations

from rh_api.repositories.base import BaseRepository
from rh_api.services.helpers import clamp_limit


def test_clamp_limit_uses_default_when_value_is_falsy():
    assert clamp_limit(None, default=20, maximum=100) == 20
    assert clamp_limit(0, default=20, maximum=100) == 20
    assert clamp_limit("", default=20, maximum=100) == 20


def test_clamp_limit_caps_at_maximum():
    assert clamp_limit(500, default=20, maximum=100) == 100


def test_clamp_limit_floors_at_minimum():
    assert clamp_limit(-5, default=20, maximum=100) == 1
    assert clamp_limit(-5, default=20, maximum=100, minimum=5) == 5


def test_clamp_limit_passes_through_valid_value():
    assert clamp_limit(42, default=20, maximum=100) == 42


def test_clamp_limit_coerces_numeric_strings():
    assert clamp_limit("15", default=20, maximum=100) == 15


def test_base_repository_clamp_limit_delegates_to_shared_helper():
    assert BaseRepository._clamp_limit(500, default=20, maximum=100) == 100
    assert BaseRepository._clamp_limit(None, default=20, maximum=100) == 20
