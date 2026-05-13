"""
GitHub Autonomous Engineering API Routes
Clone, commit, push, PR, issues — all autonomous
"""

import os
import time
import asyncio
import tempfile
import shutil
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request

from core.models import (
    GitHubCloneRequest, GitHubCreateRepoRequest,
    GitHubCommitRequest, GitHubPRRequest, GitHubIssueRequest,
)
from memory.db import save_memory

router = APIRouter()

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_OWNER = os.environ.get("GITHUB_OWNER", "")
GITHUB_API = "https://api.github.com"


def gh_headers():
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=400, detail="GITHUB_TOKEN not configured")
    return {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def gh_get(path: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{GITHUB_API}{path}", headers=gh_headers())
        r.raise_for_status()
        return r.json()


async def gh_post(path: str, data: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{GITHUB_API}{path}", headers=gh_headers(), json=data)
        r.raise_for_status()
        return r.json()


async def gh_put(path: str, data: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.put(f"{GITHUB_API}{path}", headers=gh_headers(), json=data)
        r.raise_for_status()
        return r.json()


async def gh_patch(path: str, data: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.patch(f"{GITHUB_API}{path}", headers=gh_headers(), json=data)
        r.raise_for_status()
        return r.json()


# ─── Clone ────────────────────────────────────────────────────────────────────

@router.post("/clone", summary="Clone a GitHub repository")
async def clone_repo(req: GitHubCloneRequest):
    try:
        import git
    except ImportError:
        raise HTTPException(status_code=500, detail="gitpython not installed")

    local_path = req.local_path or f"/tmp/repos/{req.repo_url.split('/')[-1].replace('.git', '')}"
    os.makedirs(local_path, exist_ok=True)

    if GITHUB_TOKEN:
        url = req.repo_url.replace("https://", f"https://{GITHUB_TOKEN}@")
    else:
        url = req.repo_url

    try:
        if os.path.exists(os.path.join(local_path, ".git")):
            repo = git.Repo(local_path)
            repo.remotes.origin.pull()
            action = "pulled"
        else:
            repo = git.Repo.clone_from(url, local_path, branch=req.branch, depth=1)
            action = "cloned"

        files = []
        for root, dirs, fnames in os.walk(local_path):
            dirs[:] = [d for d in dirs if d not in [".git", "node_modules", "__pycache__"]]
            for f in fnames[:50]:
                files.append(os.path.relpath(os.path.join(root, f), local_path))

        # Save to memory
        await save_memory(
            content=f"Repo {req.repo_url} cloned to {local_path}. Files: {', '.join(files[:20])}",
            memory_type="repo",
            key=req.repo_url,
        )

        return {
            "action": action,
            "repo_url": req.repo_url,
            "local_path": local_path,
            "branch": req.branch,
            "files_count": len(files),
            "files": files[:30],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clone failed: {str(e)}")


# ─── Create Repo ──────────────────────────────────────────────────────────────

@router.post("/create_repo", summary="Create a new GitHub repository")
async def create_repo(req: GitHubCreateRepoRequest):
    data = {
        "name": req.name,
        "description": req.description,
        "private": req.private,
        "auto_init": req.auto_init,
    }
    try:
        result = await gh_post("/user/repos", data)
        return {
            "repo": result["full_name"],
            "url": result["html_url"],
            "clone_url": result["clone_url"],
            "default_branch": result.get("default_branch", "main"),
            "private": result["private"],
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


# ─── Commit Files ─────────────────────────────────────────────────────────────

@router.post("/commit", summary="Commit files to a repository")
async def commit_files(req: GitHubCommitRequest):
    import base64

    owner_repo = req.repo if "/" in req.repo else f"{GITHUB_OWNER}/{req.repo}"
    results = []

    for file_path, content in req.files.items():
        encoded = base64.b64encode(content.encode()).decode()

        # Get current SHA if file exists
        sha = None
        try:
            existing = await gh_get(f"/repos/{owner_repo}/contents/{file_path}?ref={req.branch}")
            sha = existing.get("sha")
        except Exception:
            pass

        payload = {
            "message": req.message,
            "content": encoded,
            "branch": req.branch,
        }
        if sha:
            payload["sha"] = sha

        try:
            result = await gh_put(f"/repos/{owner_repo}/contents/{file_path}", payload)
            results.append({"file": file_path, "status": "committed", "sha": result["content"]["sha"]})
        except Exception as e:
            results.append({"file": file_path, "status": "error", "error": str(e)})

    return {
        "repo": owner_repo,
        "branch": req.branch,
        "message": req.message,
        "files": results,
        "committed": sum(1 for r in results if r["status"] == "committed"),
    }


# ─── Push ─────────────────────────────────────────────────────────────────────

@router.post("/push", summary="Push local changes to remote")
async def push_changes(
    repo_path: str,
    branch: str = "main",
    message: str = "Auto-commit by Devin Agent",
):
    try:
        import git
        repo = git.Repo(repo_path)
        repo.git.add(A=True)
        if repo.index.diff("HEAD") or repo.untracked_files:
            repo.index.commit(message)
        origin = repo.remote("origin")
        origin.push(refspec=f"HEAD:{branch}")
        return {"status": "pushed", "branch": branch, "message": message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Push failed: {str(e)}")


# ─── Create PR ────────────────────────────────────────────────────────────────

@router.post("/pr/create", summary="Create a Pull Request")
async def create_pr(req: GitHubPRRequest):
    owner_repo = req.repo if "/" in req.repo else f"{GITHUB_OWNER}/{req.repo}"
    data = {
        "title": req.title,
        "body": req.body,
        "head": req.head,
        "base": req.base,
        "draft": req.draft,
    }
    try:
        result = await gh_post(f"/repos/{owner_repo}/pulls", data)
        return {
            "pr_number": result["number"],
            "title": result["title"],
            "url": result["html_url"],
            "state": result["state"],
            "head": req.head,
            "base": req.base,
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


# ─── Create Issue ─────────────────────────────────────────────────────────────

@router.post("/issues/create", summary="Create a GitHub Issue")
async def create_issue(req: GitHubIssueRequest):
    owner_repo = req.repo if "/" in req.repo else f"{GITHUB_OWNER}/{req.repo}"
    data = {"title": req.title, "body": req.body, "labels": req.labels}
    try:
        result = await gh_post(f"/repos/{owner_repo}/issues", data)
        return {
            "issue_number": result["number"],
            "title": result["title"],
            "url": result["html_url"],
            "state": result["state"],
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


# ─── Code Review ──────────────────────────────────────────────────────────────

@router.post("/review", summary="AI code review for a PR")
async def review_pr(repo: str, pr_number: int, request: Request):
    owner_repo = repo if "/" in repo else f"{GITHUB_OWNER}/{repo}"
    try:
        pr = await gh_get(f"/repos/{owner_repo}/pulls/{pr_number}")
        files = await gh_get(f"/repos/{owner_repo}/pulls/{pr_number}/files")

        file_changes = []
        for f in files[:10]:
            file_changes.append(f"{f['filename']}: +{f.get('additions',0)}/-{f.get('deletions',0)}")

        ws = request.app.state.ws_manager
        from core.agent import AgentCore
        agent = AgentCore(ws)

        review_prompt = (
            f"Review this Pull Request:\n"
            f"Title: {pr['title']}\n"
            f"Description: {pr.get('body', 'No description')}\n"
            f"Files changed: {chr(10).join(file_changes)}\n\n"
            f"Provide a constructive code review with: summary, potential issues, suggestions, and verdict."
        )
        messages = [
            {"role": "system", "content": "You are a senior software engineer doing code review. Be constructive, specific, and helpful."},
            {"role": "user", "content": review_prompt},
        ]
        review = await agent.llm_stream(messages)

        # Post review comment
        if GITHUB_TOKEN:
            await gh_post(f"/repos/{owner_repo}/issues/{pr_number}/comments", {"body": f"🤖 **Devin Agent Code Review**\n\n{review}"})

        return {
            "pr_number": pr_number,
            "title": pr["title"],
            "review": review,
            "files_reviewed": len(files),
            "posted_to_github": bool(GITHUB_TOKEN),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Repo Info ────────────────────────────────────────────────────────────────

@router.get("/repo/{owner}/{repo}", summary="Get repository info")
async def get_repo_info(owner: str, repo: str):
    try:
        info = await gh_get(f"/repos/{owner}/{repo}")
        return {
            "name": info["name"],
            "full_name": info["full_name"],
            "description": info.get("description"),
            "url": info["html_url"],
            "default_branch": info["default_branch"],
            "language": info.get("language"),
            "stars": info["stargazers_count"],
            "forks": info["forks_count"],
            "open_issues": info["open_issues_count"],
            "private": info["private"],
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


# ─── Status check ─────────────────────────────────────────────────────────────

@router.get("/status", summary="GitHub integration status")
async def github_status():
    configured = bool(GITHUB_TOKEN)
    user = None
    if configured:
        try:
            user_info = await gh_get("/user")
            user = user_info.get("login")
        except Exception:
            configured = False
    return {
        "configured": configured,
        "user": user,
        "owner": GITHUB_OWNER or user,
        "capabilities": [
            "clone", "create_repo", "commit", "push",
            "pr/create", "issues/create", "review"
        ],
    }
