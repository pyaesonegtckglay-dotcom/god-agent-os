"""
👁️ Vision Space — Visual Processing Domain
Image understanding, UI generation, OCR, visual analysis.
"""
from typing import Dict
import structlog
from .base_space import BaseSpace

log = structlog.get_logger()

VISION_SYSTEM = """You are GOD AGENT OS v9 — Vision Space Expert.

You specialize in:
- UI/UX design and code generation (React, Next.js, Tailwind)
- Visual layout descriptions and wireframing
- Image analysis and description
- Design-to-code conversion
- CSS and styling
- Responsive design patterns
- Component library creation (shadcn/ui, Radix, MUI)
- Color theory and design systems
- Accessibility (WCAG) guidelines
- Animation and interaction design (Framer Motion, CSS animations)

When creating UI components, always use modern frameworks and produce clean, production-ready code.
"""


class VisionSpace(BaseSpace):
    space_name = "vision"
    space_description = "Visual processing — UI generation, image analysis, design-to-code."
    available_roles = ["visual_intelligence", "execution", "cognition"]
    
    def __init__(self, ws_manager=None, ai_router=None):
        super().__init__(ws_manager, ai_router)
        self.register_tool("generate_ui", self._generate_ui, "Generate UI components from descriptions")
        self.register_tool("analyze_design", self._analyze_design, "Analyze design requirements")
        self.register_tool("design_system", self._design_system, "Create design system tokens")
    
    async def _generate_ui(self, description: str, framework: str = "react", **kwargs) -> str:
        return f"Generating {framework} UI for: {description}"
    
    async def _analyze_design(self, description: str, **kwargs) -> str:
        return f"Analyzing design: {description}"
    
    async def _design_system(self, brand: str, **kwargs) -> str:
        return f"Creating design system for: {brand}"
    
    async def execute(self, task: str, role: str, session_id: str, context: Dict = None) -> str:
        context = context or {}
        
        await self.stream_update(session_id, f"👁️ Vision Space activated — {role} role")
        
        mem_context = ""
        if context.get("short_term_memory"):
            recent = context["short_term_memory"][-2:]
            mem_context = "\n".join([f"- {m.get('content','')[:80]}" for m in recent])
        
        enhanced_system = f"""{VISION_SYSTEM}

Active Role: {role.upper()}
Recent Context: {mem_context or 'None'}

For UI generation tasks:
- Use React + TypeScript + Tailwind CSS by default
- Create complete, self-contained components
- Include all necessary imports
- Add PropTypes or TypeScript interfaces
- Make it responsive and accessible"""
        
        try:
            response = await self.ai_router.complete(
                prompt=task,
                system=enhanced_system,
                max_tokens=4096,
            )
            return response.get("content", "Vision Space could not process the request.")
        except Exception as e:
            log.error(f"VisionSpace error: {e}")
            return f"Vision Space error: {str(e)}"
