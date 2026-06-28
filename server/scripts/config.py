"""火山引擎 API 统一配置"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

VOLCENGINE_API_KEY = os.environ["VOLCENGINE_API_KEY"]
VOLCENGINE_BASE_URL = os.environ.get("VOLCENGINE_BASE_URL", "https://ark.cn-beijing.volces.com")
VOLCENGINE_CODE_MODEL = os.environ.get("VOLCENGINE_CODE_MODEL", "ark-code-latest")
VOLCENGINE_IMAGE_MODEL = os.environ.get("VOLCENGINE_IMAGE_MODEL", "doubao-seedream-4-5-251128")

# 各端点 URL
IMAGE_API_URL = f"{VOLCENGINE_BASE_URL}/api/v3/images/generations"
CODE_API_URL = f"{VOLCENGINE_BASE_URL}/api/coding"


def volcengine_headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {VOLCENGINE_API_KEY}",
    }


def volcengine_code_payload(prompt: str, **kwargs) -> dict:
    return {
        "model": VOLCENGINE_CODE_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        **kwargs,
    }
