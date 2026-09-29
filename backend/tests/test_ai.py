"""No GEMINI_API_KEY is set in the test environment, so every call here
exercises the fallback path — which is exactly the behavior that matters
most to verify: the feature must keep working, honestly, when the AI
provider is unavailable."""


def test_generate_tasks_requires_auth(anon_client, project):
    r = anon_client.post(f"/projects/{project['id']}/ai/generate-tasks", json={})
    assert r.status_code == 401


def test_generate_tasks_falls_back_without_api_key(client, project):
    r = client.post(f"/projects/{project['id']}/ai/generate-tasks", json={})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "fallback"
    assert len(body["tasks"]) == 5
    for task in body["tasks"]:
        assert task["title"]
        assert task["description"]
        assert task["priority"] in {"low", "medium", "high"}


def test_generate_tasks_respects_count(client, project):
    r = client.post(f"/projects/{project['id']}/ai/generate-tasks", json={"count": 3})
    assert r.status_code == 200
    assert len(r.json()["tasks"]) == 3


def test_generate_tasks_count_out_of_range_returns_422(client, project):
    r = client.post(f"/projects/{project['id']}/ai/generate-tasks", json={"count": 20})
    assert r.status_code == 422


def test_generate_tasks_on_other_users_project_returns_404(other_client, project):
    r = other_client.post(f"/projects/{project['id']}/ai/generate-tasks", json={})
    assert r.status_code == 404


def test_generate_tasks_project_not_found_returns_404(client):
    r = client.post(
        "/projects/00000000-0000-0000-0000-000000000000/ai/generate-tasks", json={}
    )
    assert r.status_code == 404
