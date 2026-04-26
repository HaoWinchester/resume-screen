"""Tests for the /api/v1/auth endpoints."""

import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


class TestRegister:
    """POST /api/v1/auth/register"""

    async def test_register_success(self, async_client: AsyncClient):
        payload = {
            "email": "newuser@example.com",
            "password": "securepass1",
            "name": "New User",
            "company_name": "Fresh Corp",
        }
        resp = await async_client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 201
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert body["user"]["email"] == "newuser@example.com"
        assert body["user"]["role"] == "admin"
        assert "id" in body["user"]
        assert "company_id" in body["user"]

    async def test_register_duplicate_email(self, async_client: AsyncClient):
        payload = {
            "email": "dupe@example.com",
            "password": "securepass1",
            "name": "First User",
            "company_name": "Company A",
        }
        await async_client.post("/api/v1/auth/register", json=payload)

        payload2 = {
            "email": "dupe@example.com",
            "password": "otherpass12",
            "name": "Second User",
            "company_name": "Company B",
        }
        resp = await async_client.post("/api/v1/auth/register", json=payload2)
        assert resp.status_code == 409

    async def test_register_missing_fields(self, async_client: AsyncClient):
        resp = await async_client.post("/api/v1/auth/register", json={})
        assert resp.status_code == 422

    async def test_register_short_password(self, async_client: AsyncClient):
        payload = {
            "email": "shortpw@example.com",
            "password": "abc",
            "name": "Short PW",
            "company_name": "PW Corp",
        }
        resp = await async_client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 422


class TestLogin:
    """POST /api/v1/auth/login"""

    async def test_login_success(self, async_client: AsyncClient):
        # Register first
        reg_payload = {
            "email": "loginuser@example.com",
            "password": "securepass1",
            "name": "Login User",
            "company_name": "Login Corp",
        }
        await async_client.post("/api/v1/auth/register", json=reg_payload)

        login_payload = {
            "email": "loginuser@example.com",
            "password": "securepass1",
        }
        resp = await async_client.post("/api/v1/auth/login", json=login_payload)
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["user"]["email"] == "loginuser@example.com"

    async def test_login_wrong_password(self, async_client: AsyncClient):
        reg_payload = {
            "email": "wrongpw@example.com",
            "password": "securepass1",
            "name": "Wrong PW User",
            "company_name": "WP Corp",
        }
        await async_client.post("/api/v1/auth/register", json=reg_payload)

        resp = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "wrongpw@example.com", "password": "badpassword"},
        )
        assert resp.status_code == 401

    async def test_login_nonexistent_email(self, async_client: AsyncClient):
        resp = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "whatever12"},
        )
        assert resp.status_code == 401


class TestResetPassword:
    """POST /api/v1/auth/reset-password"""

    async def test_reset_password(self, async_client: AsyncClient):
        # Register a user first
        reg_payload = {
            "email": "reset@example.com",
            "password": "securepass1",
            "name": "Reset User",
            "company_name": "Reset Corp",
        }
        await async_client.post("/api/v1/auth/register", json=reg_payload)

        resp = await async_client.post(
            "/api/v1/auth/reset-password",
            json={"email": "reset@example.com"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "message" in body

    async def test_reset_password_nonexistent_email(self, async_client: AsyncClient):
        # The endpoint is a stub that always returns success regardless of email
        resp = await async_client.post(
            "/api/v1/auth/reset-password",
            json={"email": "ghost@example.com"},
        )
        # Stub implementation returns 200 even for unknown emails
        assert resp.status_code == 200
