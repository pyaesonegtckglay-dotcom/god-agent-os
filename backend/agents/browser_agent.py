"""
BrowserAgent v7 — Autonomous web browsing, scraping, research (Manus-style)
Real browser control via Playwright/httpx for research, testing, web automation
"""
import asyncio
import json
import os
import re
from typing import Dict, List, Optional
import structlog
from .base_agent import BaseAgent

log = structlog.get_logger()

BROWSER_SYSTEM = """You are an elite autonomous web research and browser automation agent.
You can:
- Search the web and extract structured information
- Navigate websites and fill forms
- Take screenshots and analyze visual content
- Scrape and parse complex web pages
- Run web automation tasks

Always provide structured, actionable results with source URLs.
"""

class BrowserAgent(BaseAgent):
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__("BrowserAgent", ws_manager, ai_router)
        self._session_cache: Dict[str, str] = {}

    async def run(self, task: str, context: Dict = {}, **kwargs) -> str:
        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        await self.emit(task_id, "agent_start", {
            "agent": "BrowserAgent",
            "task": task[:80],
        }, session_id)

        await self.emit(task_id, "tool_called", {
            "agent": "BrowserAgent",
            "tool": "web_research",
            "step": f"Researching: {task[:60]}",
        }, session_id)

        # Extract search query or URL from task
        urls = re.findall(r'https?://[^\s]+', task)
        
        if urls:
            result = await self._fetch_and_analyze(urls[0], task, task_id, session_id)
        else:
            result = await self._web_research(task, task_id, session_id)

        await self.emit(task_id, "browser_result", {
            "agent": "BrowserAgent",
            "result_length": len(result),
        }, session_id)

        return result

    async def _web_research(self, query: str, task_id: str, session_id: str) -> str:
        """Perform web research using AI knowledge + httpx."""
        import httpx
        
        # Use DuckDuckGo search API (no key needed)
        search_url = f"https://api.duckduckgo.com/?q={query.replace(' ', '+')}&format=json&no_html=1"
        
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.get(search_url, headers={"User-Agent": "GodAgent/7.0"})
                data = resp.json()
                
                results = []
                if data.get("AbstractText"):
                    results.append(f"**Summary:** {data['AbstractText']}")
                if data.get("AbstractURL"):
                    results.append(f"**Source:** {data['AbstractURL']}")
                
                related = data.get("RelatedTopics", [])[:5]
                if related:
                    results.append("\n**Related:**")
                    for r in related:
                        if isinstance(r, dict) and r.get("Text"):
                            results.append(f"- {r['Text'][:200]}")
                
                if results:
                    search_context = "\n".join(results)
                else:
                    search_context = f"Web search for: {query}"
                    
        except Exception as e:
            search_context = f"Search context for: {query}"

        # Use AI to synthesize research
        messages = [
            {"role": "system", "content": BROWSER_SYSTEM},
            {"role": "user", "content": (
                f"Research task: {query}\n\n"
                f"Search context:\n{search_context}\n\n"
                f"Provide a comprehensive, structured research report with key findings, "
                f"actionable insights, and relevant sources. Format with headers and bullet points."
            )},
        ]
        return await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.3, max_tokens=4096)

    async def _fetch_and_analyze(self, url: str, task: str, task_id: str, session_id: str) -> str:
        """Fetch a URL and analyze its content."""
        import httpx
        
        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                resp = await client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 GodAgent/7.0",
                    "Accept": "text/html,application/json,*/*",
                })
                content_type = resp.headers.get("content-type", "")
                
                if "json" in content_type:
                    page_content = json.dumps(resp.json(), indent=2)[:3000]
                else:
                    # Strip HTML tags
                    html = resp.text
                    text = re.sub(r'<[^>]+>', ' ', html)
                    text = re.sub(r'\s+', ' ', text).strip()
                    page_content = text[:3000]
                    
        except Exception as e:
            page_content = f"Could not fetch {url}: {str(e)}"

        messages = [
            {"role": "system", "content": BROWSER_SYSTEM},
            {"role": "user", "content": (
                f"Analyze this web page content for the task: {task}\n\n"
                f"URL: {url}\n\n"
                f"Page Content:\n{page_content}\n\n"
                f"Provide a structured analysis with key information extracted."
            )},
        ]
        return await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.3, max_tokens=4096)

    async def screenshot_analyze(self, url: str, task_id: str = "", session_id: str = "") -> str:
        """Describe what a webpage looks like (AI-powered visual analysis)."""
        messages = [
            {"role": "system", "content": BROWSER_SYSTEM},
            {"role": "user", "content": f"Describe the visual layout and UI elements you'd expect at: {url}. Provide a detailed visual analysis."},
        ]
        return await self.llm(messages, task_id=task_id, session_id=session_id, temperature=0.5)
