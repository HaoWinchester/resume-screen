"""Tests for the /api/v1/companies endpoints."""

import pytest
from httpx import AsyncClient

from app.models import UserRole


pytestmark = pytest.mark.asyncio


class TestGetCompanyInfo:
    """GET /api/v1/companies/me"""

    async def test_get_company_info(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        test_company,
    ):
        resp = await async_client.get(
            "/api/v1/companies/me",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == str(test_company.id)
        assert body["name"] == "Test Company"
        assert "contact_name" in body
        assert "contact_phone" in body
        assert "created_at" in body


class TestUpdateCompanyInfo:
    """PATCH /api/v1/companies/me"""

    async def test_update_company_contact_info(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        resp = await async_client.patch(
            "/api/v1/companies/me",
            json={
                "name": "Test Company",
                "industry": "Technology",
                "contact_name": "HR Talent",
                "contact_phone": "13800000000",
                "contact_email": "hr@example.com",
            },
            headers=auth_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["contact_name"] == "HR Talent"
        assert body["contact_phone"] == "13800000000"
        assert body["contact_email"] == "hr@example.com"

    async def test_update_company_info_admin_only(
        self,
        async_client: AsyncClient,
        operator_headers: dict,
    ):
        resp = await async_client.patch(
            "/api/v1/companies/me",
            json={"name": "Test Company", "contact_name": "HR", "contact_phone": "13800000000"},
            headers=operator_headers,
        )

        assert resp.status_code == 403


class TestListMembers:
    """GET /api/v1/companies/me/members"""

    async def test_list_members_admin_only(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        operator_headers: dict,
        test_user,
        test_operator,
    ):
        # Admin can see members
        resp_admin = await async_client.get(
            "/api/v1/companies/me/members",
            headers=auth_headers,
        )
        assert resp_admin.status_code == 200
        body = resp_admin.json()
        assert body["total"] >= 2
        assert len(body["members"]) >= 2

        # Operator is forbidden
        resp_op = await async_client.get(
            "/api/v1/companies/me/members",
            headers=operator_headers,
        )
        assert resp_op.status_code == 403


class TestInviteMember:
    """POST /api/v1/companies/me/invite"""

    async def test_invite_member(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        resp = await async_client.post(
            "/api/v1/companies/me/invite",
            json={
                "email": "invited@example.com",
                "name": "Invited User",
                "role": "operator",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["email"] == "invited@example.com"
        assert body["role"] == "operator"
        assert "temp_password" in body

    async def test_invite_duplicate_member(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        test_operator,
    ):
        # test_operator is already in the company
        resp = await async_client.post(
            "/api/v1/companies/me/invite",
            json={
                "email": "operator@example.com",
                "name": "Duplicate",
                "role": "operator",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 409


class TestUpdateMemberRole:
    """PATCH /api/v1/companies/me/members/{user_id}"""

    async def test_update_member_role(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        test_operator,
    ):
        resp = await async_client.patch(
            f"/api/v1/companies/me/members/{test_operator.id}",
            json={"role": "admin"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["role"] == "admin"

    async def test_cannot_modify_self_role(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        test_user,
    ):
        resp = await async_client.patch(
            f"/api/v1/companies/me/members/{test_user.id}",
            json={"role": "operator"},
            headers=auth_headers,
        )
        assert resp.status_code == 403

    async def test_update_nonexistent_member(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
    ):
        import uuid

        resp = await async_client.patch(
            f"/api/v1/companies/me/members/{uuid.uuid4()}",
            json={"role": "admin"},
            headers=auth_headers,
        )
        assert resp.status_code == 404
