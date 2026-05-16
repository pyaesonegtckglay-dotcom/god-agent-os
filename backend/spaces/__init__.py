from .base_space import BaseSpace
from .catalog import SPACE_CATALOG, SPACE_INDEX
from .worker_space import WorkerSpace


def build_all_spaces(ws_manager=None, ai_router=None):
    return {
        spec["id"]: WorkerSpace(spec=spec, ws_manager=ws_manager, ai_router=ai_router)
        for spec in SPACE_CATALOG
    }


__all__ = [
    "BaseSpace",
    "WorkerSpace",
    "SPACE_CATALOG",
    "SPACE_INDEX",
    "build_all_spaces",
]
