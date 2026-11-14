import os
import logging

logger = logging.getLogger("result_ai.env_loader")

def load_dotenv(force_reload: bool = False):
    """
    Reads key-value pairs from .env file into os.environ if present.
    Supports project root directory detection and optional force reload.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_paths = [
        os.path.join(base_dir, ".env"),
        os.path.join(os.getcwd(), ".env"),
        ".env"
    ]

    for env_path in env_paths:
        if os.path.isfile(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip().strip("'\"")
                        if key:
                            if force_reload or key not in os.environ or not os.environ[key]:
                                os.environ[key] = val
                logger.info(f"Loaded environment variables from {env_path}")
            except Exception as e:
                logger.warning(f"Error loading .env file at {env_path}: {e}")
            break

# Auto-load on import
load_dotenv()
