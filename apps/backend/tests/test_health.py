# Implements: NFR-01
# Safety:    none
# Owner:     backend (zhsraD)

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_api_health_check(client: AsyncClient):
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
