import asyncio
import pytest
from starlette.requests import Request

from backend.dependencies import TenantMiddleware, tenant_var
from backend.model import Tenant


def _build_request(tenant_id: str) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(b"tenant-id", tenant_id.encode())],
    }
    return Request(scope)


def test_tenant_middleware_resets_context_on_exception():
    async def run_test():
        Tenant(name="Test", identifier="tenant1").save()
        middleware = TenantMiddleware(lambda req: None)
        request = _build_request("tenant1")
        token = tenant_var.set("original")
        try:
            async def call_next(req):
                raise RuntimeError("boom")
            with pytest.raises(RuntimeError):
                await middleware.dispatch(request, call_next)
            assert tenant_var.get() == "original"
        finally:
            tenant_var.reset(token)

    asyncio.run(run_test())
