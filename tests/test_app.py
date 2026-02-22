import pytest


def test_app_import():
    from app import app
    assert app is not None


def test_app_responds():
    from app import app
    app.config['TESTING'] = True
    with app.test_client() as c:
        rv = c.get('/')
    assert rv.status_code in (200, 302)
