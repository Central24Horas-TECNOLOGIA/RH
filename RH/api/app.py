try:
    from .rh_api.main import app
except ImportError:
    from rh_api.main import app
