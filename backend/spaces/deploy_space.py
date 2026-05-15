"""
🚀 Deploy Space — The Infrastructure Domain
Cloud deployments, CI/CD, containerization.
"""
from typing import Dict
import structlog
from .base_space import BaseSpace

log = structlog.get_logger()

DEPLOY_SYSTEM = """You are GOD AGENT OS v9 — Deploy Space Expert.

You specialize in:
- Vercel deployments (Next.js, React, API routes)
- Hugging Face Spaces (Gradio, Streamlit, Docker)
- Docker containerization and Docker Compose
- GitHub Actions CI/CD pipelines
- AWS deployments (EC2, Lambda, ECS, S3)
- GCP deployments (Cloud Run, App Engine)
- Kubernetes manifests and Helm charts
- Environment variable management
- Domain configuration and SSL
- CDN setup (Cloudflare, AWS CloudFront)
- Database migrations and deployment strategies
- Blue-green and canary deployments
- Monitoring setup (Prometheus, Grafana)

Always provide:
1. Complete configuration files
2. Step-by-step deployment commands
3. Environment variable templates (.env.example)
4. Troubleshooting tips for common issues
"""


class DeploySpace(BaseSpace):
    space_name = "deploy"
    space_description = "Infrastructure domain — cloud deployments, CI/CD, containerization."
    available_roles = ["automation", "execution", "cognition"]
    
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__(ws_manager, ai_router)
        self.register_tool("gen_dockerfile", self._gen_dockerfile, "Generate Dockerfile")
        self.register_tool("gen_github_actions", self._gen_github_actions, "Generate GitHub Actions workflow")
        self.register_tool("gen_vercel_config", self._gen_vercel_config, "Generate Vercel configuration")
        self.register_tool("gen_hf_config", self._gen_hf_config, "Generate HuggingFace Space config")
        self.register_tool("gen_k8s_manifest", self._gen_k8s_manifest, "Generate Kubernetes manifests")
    
    async def _gen_dockerfile(self, app_type: str = "python", **kwargs) -> str:
        return f"Generating Dockerfile for {app_type}"
    
    async def _gen_github_actions(self, workflow_type: str = "deploy", **kwargs) -> str:
        return f"Generating GitHub Actions for {workflow_type}"
    
    async def _gen_vercel_config(self, **kwargs) -> str:
        return "Generating vercel.json"
    
    async def _gen_hf_config(self, **kwargs) -> str:
        return "Generating HF Space README.md"
    
    async def _gen_k8s_manifest(self, app_name: str = "app", **kwargs) -> str:
        return f"Generating K8s manifest for {app_name}"
    
    async def execute(self, task: str, role: str, session_id: str, context: Dict = None) -> str:
        context = context or {}
        
        await self.stream_update(session_id, f"🚀 Deploy Space activated — {role} role")
        
        # Detect deployment target
        task_lower = task.lower()
        targets = []
        if "vercel" in task_lower:
            targets.append("Vercel")
        if "huggingface" in task_lower or "hf" in task_lower or "hugging face" in task_lower:
            targets.append("HuggingFace Spaces")
        if "docker" in task_lower:
            targets.append("Docker")
        if "github actions" in task_lower or "ci/cd" in task_lower:
            targets.append("GitHub Actions")
        if "aws" in task_lower or "lambda" in task_lower:
            targets.append("AWS")
        if "kubernetes" in task_lower or "k8s" in task_lower:
            targets.append("Kubernetes")
        
        targets_str = ", ".join(targets) if targets else "general deployment"
        
        mem_context = ""
        if context.get("short_term_memory"):
            recent = context["short_term_memory"][-2:]
            mem_context = "\n".join([f"- {m.get('content','')[:80]}" for m in recent])
        
        enhanced_system = f"""{DEPLOY_SYSTEM}

Active Role: {role.upper()}
Deployment Targets: {targets_str}
Recent Context: {mem_context or 'None'}

Provide complete, copy-paste ready configurations."""
        
        try:
            response = await self.ai_router.complete(
                prompt=task,
                system=enhanced_system,
                max_tokens=4096,
            )
            return response.get("content", "Deploy Space could not generate configuration.")
        except Exception as e:
            log.error(f"DeploySpace error: {e}")
            return f"Deploy Space error: {str(e)}"
