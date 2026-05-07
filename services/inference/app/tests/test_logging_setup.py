from __future__ import annotations

from app.utils.logging_setup import kv


def test_kv_renders_basic_pairs_in_order() -> None:
    assert kv(a=1, b="two") == "a=1 b=two"


def test_kv_quotes_values_with_spaces_or_equals() -> None:
    assert kv(msg="hello world") == 'msg="hello world"'
    assert kv(eq="x=y") == 'eq="x=y"'


def test_kv_renders_none_explicitly() -> None:
    # Absence is meaningful in our logs (a field set to None is *known* to
    # be missing) so we render it instead of dropping the key.
    assert kv(session_id=None) == "session_id=none"


def test_kv_escapes_embedded_quotes() -> None:
    assert kv(s='he said "hi"') == 's="he said \\"hi\\""'
