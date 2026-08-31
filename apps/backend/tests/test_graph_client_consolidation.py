from __future__ import annotations

import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from rh_api.repositories.base import BaseRepository
from rh_api.repositories.communications import CommunicationRepositoryMixin
from rh_api.services.graph_client import GraphClient


class FakeCommsRepository(CommunicationRepositoryMixin, BaseRepository):
    def __init__(self, settings):
        self.settings = settings


def _settings(**overrides) -> SimpleNamespace:
    base = {
        "email_graph_tenant_id": "tenant-123",
        "email_graph_client_id": "client-123",
        "email_graph_client_secret_env": "TEST_GRAPH_CLIENT_SECRET",
        "email_graph_scope": "",
        "email_graph_base_url": "",
    }
    base.update(overrides)
    return SimpleNamespace(**base)


@pytest.fixture(autouse=True)
def _graph_secret_env():
    os.environ["TEST_GRAPH_CLIENT_SECRET"] = "super-secret"
    yield
    os.environ.pop("TEST_GRAPH_CLIENT_SECRET", None)


class TestGraphClientConsolidation:
    def test_communications_graph_client_is_configured_from_settings(self):
        repo = FakeCommsRepository(_settings())
        client = repo._graph_client()

        assert isinstance(client, GraphClient)
        assert client.tenant_id == "tenant-123"
        assert client.client_id == "client-123"
        assert client.client_secret == "super-secret"
        assert client.configured is True

    def test_communications_graph_client_keeps_mail_specific_forbidden_message(self):
        repo = FakeCommsRepository(_settings())
        client = repo._graph_client()

        assert "Mail.Read" in client.forbidden_message
        assert "Mail.ReadBasic.All" in client.forbidden_message

    def test_get_graph_token_raises_503_when_unconfigured(self):
        repo = FakeCommsRepository(_settings(email_graph_tenant_id=""))

        with pytest.raises(HTTPException) as exc_info:
            repo._get_graph_token()

        assert exc_info.value.status_code == 503
        assert "Microsoft Graph ainda não configurado" in exc_info.value.detail

    def test_graph_request_reuses_a_pre_fetched_token_without_calling_get_token_again(self):
        repo = FakeCommsRepository(_settings())

        fake_response = MagicMock(status_code=200, content=b"{}")
        fake_response.json.return_value = {"value": []}
        fake_client = MagicMock()
        fake_client.__enter__.return_value.request.return_value = fake_response

        with patch("rh_api.services.graph_client.httpx.Client", return_value=fake_client), patch.object(
            GraphClient, "_get_token"
        ) as mock_get_token:
            result = repo._graph_request("ja-tenho-um-token", "/me/messages")

        mock_get_token.assert_not_called()
        assert result == {"value": []}
        _, call_kwargs = fake_client.__enter__.return_value.request.call_args
        assert call_kwargs["headers"]["Authorization"] == "Bearer ja-tenho-um-token"

    def test_get_graph_token_fetches_a_new_token_via_azure_ad(self):
        repo = FakeCommsRepository(_settings())

        fake_response = MagicMock(status_code=200)
        fake_response.json.return_value = {"access_token": "novo-token"}
        fake_client = MagicMock()
        fake_client.__enter__.return_value.post.return_value = fake_response

        with patch("rh_api.services.graph_client.httpx.Client", return_value=fake_client):
            token = repo._get_graph_token()

        assert token == "novo-token"

    def test_graph_request_raises_mail_specific_message_on_forbidden(self):
        repo = FakeCommsRepository(_settings())

        fake_response = MagicMock(status_code=403, headers={"content-type": "application/json"})
        fake_response.json.return_value = {}
        fake_client = MagicMock()
        fake_client.__enter__.return_value.request.return_value = fake_response

        with patch("rh_api.services.graph_client.httpx.Client", return_value=fake_client):
            with pytest.raises(HTTPException) as exc_info:
                repo._graph_request("token-existente", "/me/messages")

        assert exc_info.value.status_code == 503
        assert "Mail.Read" in exc_info.value.detail
