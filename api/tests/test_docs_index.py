"""The README routes readers to current hosting setup and a complete historical docs index."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_readme_indexes_every_doc():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    index = readme[readme.index("## Documentation") : readme.index("## Compatibility")]
    assert "(docs/AWS_HOSTING.md)" in index
    assert "(docs/README.md)" in index
    full_index = (ROOT / "docs/README.md").read_text(encoding="utf-8")
    missing = [
        p.name for p in (ROOT / "docs").glob("*.md") if p.name != "README.md" and f"({p.name})" not in full_index
    ]
    assert not missing
    assert "../README.md#documentation" in (ROOT / "docs/ARCHITECTURE.md").read_text(encoding="utf-8")
    assert "README.md#documentation" in (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
