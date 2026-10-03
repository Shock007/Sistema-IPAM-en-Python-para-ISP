from pathlib import Path

from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404 or Path(path).suffix:
                raise
            response = await super().get_response("index.html", scope)
            response.headers["Cache-Control"] = "no-cache"
            return response