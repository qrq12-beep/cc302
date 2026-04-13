# 📝 ToDo SaaS — Full-Stack Task Management Application

> A production-grade, multi-user **Flask** task management platform built with professional DevOps practices: feature branching, Docker containerization, automated testing, and CI/CD pipelines via GitHub Actions.

---

## 📚 Table of Contents

1. [Project Overview](#-project-overview)
2. [Architecture](#-architecture)
3. [Features](#-features)
4. [API Reference](#-api-reference)
5. [Git Workflow](#-git-workflow)
6. [Docker & Versioning](#-docker--versioning)
7. [CI/CD Pipeline](#-cicd-pipeline)
8. [Testing](#-testing)
9. [Branch Protection & Quality Gates](#-branch-protection--quality-gates)
10. [Project Structure](#-project-structure)
11. [Local Setup & Running](#-local-setup--running)
12. [Data Model](#-data-model)
13. [Key Takeaways](#-key-takeaways)
14. [Author](#-author)

---

## 🚀 Project Overview

This project is a **multi-user ToDo SaaS application** that demonstrates a complete, production-style software engineering workflow. It goes beyond a simple CRUD app to showcase:

| Pillar | What's Demonstrated |
|---|---|
| **Backend Development** | Flask REST API, session auth, per-user data isolation |
| **DevOps** | Git branching strategy, Docker, semantic versioning |
| **Automation** | CI/CD pipelines with GitHub Actions |
| **Quality Assurance** | Automated pytest suite, branch protection rules |
| **Deployment** | DockerHub image registry, GitHub Releases |

The application stores data in flat JSON files per user (no external database dependency), making it easy to run locally or in a container.

---

## 🏛 Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Client (Browser)                   │
└────────────────────────┬─────────────────────────────┘
                         │ HTTP
┌────────────────────────▼─────────────────────────────┐
│              Flask Application (app.py)               │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  Auth Layer │  │ Task Routes  │  │ Stats Routes│  │
│  │  /api/login │  │ /api/tasks/* │  │  /api/stats │  │
│  │  /api/reg.. │  │              │  │             │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  │
│         └────────────────┼─────────────────┘         │
│                          │                            │
│                 ┌────────▼────────┐                   │
│                 │  Session Store  │                   │
│                 │  (Flask Cookie) │                   │
│                 └────────┬────────┘                   │
└──────────────────────────┼───────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
┌────────▼───────┐ ┌───────▼──────┐ ┌───────▼──────┐
│  users.json    │ │data_<u>_     │ │data_<u>_     │
│  (all users)   │ │tasks.json    │ │subtasks.json │
└────────────────┘ └──────────────┘ └──────────────┘
```

**Key design decisions:**
- **Per-user file isolation**: Each user's tasks and subtasks are stored in separate JSON files (`data_<username>_tasks.json`), ensuring complete data separation without a database.
- **Session-based auth**: Flask server-side sessions with SHA-256 password hashing.
- **Stateless REST API**: All routes are protected by a `require_login()` guard that checks the session.

---

## ✨ Features

### 1. Authentication System

Built from scratch — no third-party auth libraries. Passwords are SHA-256 hashed and stored in `users.json`. A `require_login()` guard on all task/stats routes returns `401` if no session exists. Users are auto-logged-in after registration.

**Validation:** username ≥ 3 chars (alphanumeric + `-_`), password ≥ 4 chars, no duplicate usernames.

---

### 2. Task Management

Full CRUD operations for tasks, with a rich data model:

| Field | Type | Description |
|---|---|---|
| `id` | Integer | Auto-incremented unique ID |
| `title` | String | Task title |
| `description` | String | Optional detailed description |
| `category` | String | Grouping label (default: `General`) |
| `priority` | String | `High`, `Medium`, or `Low` |
| `due_date` | String | ISO date string |
| `completed` | Boolean | Completion status |
| `created_at` | String | ISO datetime, set on creation |
| `tags` | Array | List of string tags |

A dedicated **toggle endpoint** (`PUT /api/tasks/<id>/toggle`) flips `completed` without requiring a full task payload, making UI interactions simpler.

---

### 3. Subtask System

Tasks support nested subtasks with full CRUD, cascade delete (removing a parent task wipes its subtasks), and drag-and-drop reordering via `PUT /api/tasks/<id>/subtasks/reorder` — accepts an ordered array of subtask IDs and updates the `order` field on each. Subtasks are always returned sorted by `order`.

---

### 4. Search, Filters & Sorting

Search tasks by title and description (`?q=`). Filter by status (completed/pending), priority (High/Medium/Low), and due date (overdue, today, this week). Sort by due date, created date, or priority.

---

### 5. Statistics Dashboard

Returns total, completed, and pending counts, plus `priority_counts` (incomplete tasks only per priority level — useful for a live work-queue view):

```json
{ "total": 12, "completed": 5, "pending": 7, "priority_counts": { "High": 2, "Medium": 3, "Low": 2 } }
```

---

## 📡 API Reference

All endpoints are prefixed with `/api`. All task/subtask/stats routes require an active session (401 if not logged in).

### Auth Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/register` | Register new user | No |
| `POST` | `/api/login` | Login | No |
| `POST` | `/api/logout` | Logout | No |
| `GET` | `/api/me` | Get current user | Yes |

### Task Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | List all tasks for current user |
| `POST` | `/api/tasks` | Create a new task |
| `PUT` | `/api/tasks/<id>` | Update a task |
| `DELETE` | `/api/tasks/<id>` | Delete task (and its subtasks) |
| `PUT` | `/api/tasks/<id>/toggle` | Toggle completed status |

### Subtask Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks/<id>/subtasks` | List subtasks (ordered) |
| `POST` | `/api/tasks/<id>/subtasks` | Add a subtask |
| `PUT` | `/api/subtasks/<id>` | Update a subtask |
| `DELETE` | `/api/subtasks/<id>` | Delete a subtask |
| `PUT` | `/api/tasks/<id>/subtasks/reorder` | Reorder subtasks |

**Reorder request body:**
```json
{ "order": [3, 1, 4, 2] }
```
Pass an array of subtask IDs in the desired display order.

### Stats Endpoint

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Get task statistics for current user |

---

## 🌿 Git Workflow

### Branch Structure

```
main          ← Production-ready, protected
  └── dev     ← Integration branch, protected
        ├── feature/task-descriptions-and-metadata
        ├── feature/search-tasks
        └── feature/filters-and-sorting
```

### Feature Branches

| Branch | Description |
|---|---|
| `feature/task-descriptions-and-metadata` | Added `description`, `priority`, `due_date`, `tags` fields + DB migration + UI updates |
| `feature/search-tasks` | Search by title/description using `?q=` query param + search bar UI |
| `feature/filters-and-sorting` | Filter by status/priority/due date; sort by due date, created date, or priority |

### Workflow Rules

- ❌ No direct commits to `main`
- ❌ No direct feature commits to `dev`
- ✅ All features merged via Pull Requests with description and test evidence
- ✅ CI must pass before any PR can be merged
- ✅ Feature → dev → main, never feature → main directly

---

## 🐳 Docker & Versioning

### Image Details

- **Registry**: DockerHub — `qrq12/todo-saas`
- **Versioning**: Semantic Versioning (`MAJOR.MINOR.PATCH`)
  - `MAJOR`: Breaking changes
  - `MINOR`: New features, backwards-compatible
  - `PATCH`: Bug fixes

### Current Releases

| Tag | Description |
|---|---|
| `0.1.0` | First feature release (metadata + search + filters) |
| `latest` | Always points to the most recent stable version |

### Build & Push

```bash
# Build with version tag
docker build -t qrq12/todo-saas:0.1.0 .

# Push versioned image
docker push qrq12/todo-saas:0.1.0

# Tag and push as latest
docker tag qrq12/todo-saas:0.1.0 qrq12/todo-saas:latest
docker push qrq12/todo-saas:latest
```

The CD pipeline handles these steps automatically on every GitHub Release — no manual pushing needed for production releases.

---

## ⚙️ CI/CD Pipeline

### Continuous Integration (`ci.yml`)
Triggers on push to `main`/`dev` and all PRs. Steps: checkout → install deps → `flake8` lint → `pytest`. A failing step blocks the PR from merging.

### Continuous Delivery (`cd.yml`)
Triggers on GitHub Release publish. Steps: checkout → extract version from tag (e.g. `v0.1.0` → `0.1.0`) → DockerHub login → build & push versioned image → tag and push as `latest`.

### Secrets

| Secret | Purpose |
|---|---|
| `DOCKERHUB_USERNAME` | DockerHub account login |
| `DOCKERHUB_TOKEN` | DockerHub access token (not password) |

---

## 🧪 Testing

Uses **pytest** with Flask's test client — no real server needed. Tests follow a full CRUD lifecycle: create → assert exists → update → assert changes → delete → assert removed.

| Test | Verifies |
|---|---|
| `test_create_task` | Task created with correct fields |
| `test_read_task` | Task appears in list |
| `test_update_task` | Changes persisted |
| `test_delete_task` | Task no longer retrievable |
| `test_toggle_task` | `completed` flips correctly |

```bash
pytest -q          # quiet
pytest -v          # verbose
pytest tests/test_crud.py  # single file
```

---

## 🛡️ Branch Protection & Quality Gates

Enabled on `dev` and `main`. PRs required before merging; all CI checks must pass.

| Scenario | Result |
|---|---|
| Pushed a failing test | ❌ CI failed → merge blocked |
| Fixed the test and re-pushed | ✅ CI passed → merge allowed |
| Merged dev → main | ✅ Full pipeline ran cleanly |

---

## 📁 Project Structure

```
.
├── app.py                    # Main Flask application — all routes and logic
├── requirements.txt          # Python dependencies
├── Dockerfile                # Container build instructions
├── users.json                # Persisted user accounts (created at runtime)
├── data_<user>_tasks.json    # Per-user task storage (created at runtime)
├── data_<user>_subtasks.json # Per-user subtask storage (created at runtime)
├── templates/
│   ├── index.html            # Main app UI (requires login)
│   └── login.html            # Login / register page
├── tests/
│   └── test_crud.py          # pytest test suite
└── .github/
    └── workflows/
        ├── ci.yml            # Continuous Integration pipeline
        └── cd.yml            # Continuous Delivery pipeline
```

---

## 🖥️ Local Setup & Running

**Python:**
```bash
git clone https://github.com/<your-username>/<your-repo>.git && cd <your-repo>
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Open [http://127.0.0.1:5000](http://127.0.0.1:5000)

**Docker:**
```bash
# Build locally
docker build -t todo-saas . && docker run -p 5000:5000 todo-saas

# Or pull from DockerHub
docker pull qrq12/todo-saas:latest
docker run -p 5000:5000 -e SECRET_KEY="your-secret" qrq12/todo-saas:latest
```

**Environment Variables:**

| Variable | Default | Notes |
|---|---|---|
| `SECRET_KEY` | Random hex at startup | **Set this in production** — random key invalidates all sessions on restart |
| `PORT` | `5000` | Flask listen port |

---

## 🗃️ Data Model

### User (`users.json`)

```json
{
  "alice": {
    "password": "<sha256-hex>",
    "created_at": "2024-01-15T10:30:00.000000"
  }
}
```

### Task (`data_alice_tasks.json`)

```json
[
  {
    "id": 1,
    "title": "Build CI pipeline",
    "description": "Set up GitHub Actions for automated testing",
    "category": "DevOps",
    "priority": "High",
    "due_date": "2024-02-01",
    "completed": false,
    "created_at": "2024-01-15T10:31:00.000000",
    "tags": ["github", "automation"]
  }
]
```

### Subtask (`data_alice_subtasks.json`)

```json
[
  {
    "id": 1,
    "task_id": 1,
    "title": "Write ci.yml",
    "is_done": true,
    "order": 0
  }
]
```

---

## 📌 Key Takeaways

| Area | Skill Practised |
|---|---|
| **Git** | Feature branching, PRs, merge conflict resolution, clean commit history |
| **Backend** | REST API design, multi-user data isolation, session auth + password hashing |
| **DevOps** | Docker containerisation, semantic versioning, GitHub Releases as deploy triggers |
| **Quality** | Automated tests, branch protection, linting enforcement |

---

## 🧑‍💻 Author

Developed as part of a coursework assignment covering:

- GitHub workflows and branching strategies
- Flask backend development
- DevOps practices (Docker, CI/CD, semantic versioning)
- Professional software engineering process

---

*For issues or questions, open a GitHub Issue on this repository.*
