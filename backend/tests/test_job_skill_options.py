import pytest


pytestmark = pytest.mark.asyncio


async def test_job_skill_options_are_bound_to_current_user(async_client, auth_headers, operator_headers, second_company_headers):
    payload = {
        "job_type": "frontend",
        "option_type": "required",
        "value": "微前端平台治理",
    }
    create_response = await async_client.post("/api/v1/job-skill-options", headers=auth_headers, json=payload)
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["value"] == "微前端平台治理"

    duplicate_response = await async_client.post("/api/v1/job-skill-options", headers=auth_headers, json=payload)
    assert duplicate_response.status_code == 200
    assert duplicate_response.json()["id"] == created["id"]

    owner_response = await async_client.get(
        "/api/v1/job-skill-options?job_type=frontend&option_type=required",
        headers=auth_headers,
    )
    assert owner_response.status_code == 200
    assert [item["value"] for item in owner_response.json()["items"]] == ["微前端平台治理"]

    same_company_other_user_response = await async_client.get(
        "/api/v1/job-skill-options?job_type=frontend&option_type=required",
        headers=operator_headers,
    )
    assert same_company_other_user_response.status_code == 200
    assert same_company_other_user_response.json()["items"] == []

    other_company_response = await async_client.get(
        "/api/v1/job-skill-options?job_type=frontend&option_type=required",
        headers=second_company_headers,
    )
    assert other_company_response.status_code == 200
    assert other_company_response.json()["items"] == []
