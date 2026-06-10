"""Category extractor package — registry and public API.

The EXTRACTOR_REGISTRY maps game-data category names to their corresponding
extractor classes. The unified pipeline uses this to dispatch extraction for
each category declared in a Book Spec.

Usage:
    from extractors import EXTRACTOR_REGISTRY, CategoryExtractor, CategoryResult, LogEntry

    extractor_cls = EXTRACTOR_REGISTRY.get(category_name)
    if extractor_cls is not None:
        extractor = extractor_cls()
        result = extractor.extract(text, spec, category_config)
"""

from extractors.base import CategoryExtractor, CategoryResult, LogEntry
from extractors.birthright_extractor import BirthrightExtractor
from extractors.book_slice_extractor import BookSliceExtractor
from extractors.boon_extractor import BoonExtractor
from extractors.calling_extractor import CallingExtractor
from extractors.equipment_extractor import EquipmentExtractor
from extractors.knack_extractor import KnackExtractor
from extractors.pantheon_extractor import PantheonExtractor
from extractors.path_extractor import PathExtractor
from extractors.purview_extractor import PurviewExtractor

# Registry mapping category name strings to their extractor classes.
# Entries are populated as concrete extractors are implemented in later tasks.
# The pipeline checks this registry to find the appropriate extractor for each
# category declared in a Book Spec's `categories` dict.
EXTRACTOR_REGISTRY: dict[str, type[CategoryExtractor]] = {
    "knacks": KnackExtractor,           # Task 3.1
    "boons": BoonExtractor,             # Task 3.2
    "purviews": PurviewExtractor,       # Task 3.3
    "callings": CallingExtractor,       # Task 3.4
    "birthrights": BirthrightExtractor,  # Task 3.5
    "equipment": EquipmentExtractor,    # Task 3.6
    "paths": PathExtractor,             # Task 3.7
    "pantheons": PantheonExtractor,     # Task 3.8
    "book_slices": BookSliceExtractor,  # Task 3.9
}

__all__ = [
    "BirthrightExtractor",
    "BookSliceExtractor",
    "BoonExtractor",
    "CallingExtractor",
    "CategoryExtractor",
    "CategoryResult",
    "EquipmentExtractor",
    "EXTRACTOR_REGISTRY",
    "KnackExtractor",
    "LogEntry",
    "PantheonExtractor",
    "PathExtractor",
    "PurviewExtractor",
]
