"""Tests de /api/v1/scheduler."""
from unittest.mock import patch


def test_scheduler_status_deshabilitado_en_tests(client):
    r = client.get("/api/v1/scheduler/status")
    assert r.status_code == 200
    body = r.json()
    assert body["running"] is False and body["job_registered"] is False
    assert body["next_run_time"] is None and "interval_hours" in body


@patch("app.api.routers.scheduler.run_scheduled_audit")
def test_run_now_dispara_auditoria(mock_audit, client):
    r = client.post("/api/v1/scheduler/run-now")
    assert r.status_code == 200
    mock_audit.assert_called_once()