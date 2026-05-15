"""
🌐 Browser Space — The Interface to the Web
Handles all internet-based research and interaction.
"""
import asyncio
import aiohttp
from typing import Dict
import structlog
from .base_space import BaseSpace

log = structlog.get_logger()


class BrowserSpace(BaseSpace):
    space_name = "browser"
    space_description = "Web interface — research, navigation, data extraction from the internet."
    available_roles = ["automation", "cognition"]
    
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__(ws_manager, ai_router)
        self.register_tool("web_search", self._web_search, "Search the web for information")
        self.register_tool("fetch_url", self._fetch_url, "Fetch content from a URL")
        self.register_tool("extract_data", self._extract_data, "Extract structured data from web pages")
    
    async def _web_search(self, query: str, **kwargs) -> str:
        """Simulate web search via DuckDuckGo."""
        try:
            encoded = query.replace(" ", "+")
            url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    data = await resp.json(content_type=None)
                    abstract = data.get("AbstractText", "")
                    related = [r.get("Text", "") for r in data.get("RelatedTopics", [])[:3] if r.get("Text")]
                    result = abstract or "No direct answer found."
                    if related:
                        result += "\n\nRelated:\n" + "\n".join([f"- {r}" for r in related])
                    return result
        except Exception as e:
            return f"Search result for '{query}': Web search attempted. Error: {str(e)}"
    
    async def _fetch_url(self, url: str, **kwargs) -> str:
        """Fetch content from a URL."""
        try:
            async with aiohttp.ClientSession() as session:
                headers = {"User-Agent": "Mozilla/5.0 (compatible; GodAgentOS/9.0)"}
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    text = await resp.text()
                    # Basic text extraction
                    import re
                    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
                    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
                    text = re.sub(r'<[^>]+>', ' ', text)
                    text = re.sub(r'\s+', ' ', text).strip()
                    return text[:3000]
        except Exception as e:
            return f"Could not fetch {url}: {str(e)}"
    
    async def _extract_data(self, url: str, **kwargs) -> str:
        content = await self._fetch_url(url)
        return f"Extracted from {url}:\n{content[:1500]}"
    
    async def execute(self, task: str, role: str, session_id: str, context: Dict = None) -> str:
        context = context or {}
        
        await self.stream_update(session_id, f"🌐 Browser Space activated — {role} role")
        
        # Try to perform web search
        search_result = ""
        try:
            search_result = await self._web_search(task)
        except Exception:
            pass
        
        # Check if task has a URL
        import re
        urls = re.findall(r'https?://[^\s]+', task)
        url_content = ""
        if urls:
            try:
                url_content = await self._fetch_url(urls[0])
            except Exception:
                pass
        
        system_prompt = self.get_space_prompt(role, task, context)
        
        enhanced_prompt = task
        if search_result:
            enhanced_prompt += f"\n\n[Web Search Results]\n{search_result}"
        if url_content:
            enhanced_prompt += f"\n\n[URL Content]\n{url_content[:1000]}"
        
        try:
            response = await self.ai_router.complete(
                prompt=enhanced_prompt,
                system=system_prompt,
                max_tokens=2048,
            )
            return response.get("content", "Browser Space could not process the request.")
        except Exception as e:
            log.error(f"BrowserSpace error: {e}")
            if search_result:
                return f"🌐 Browser Space Results:\n\n{search_result}"
            return f"Browser Space error: {str(e)}"
