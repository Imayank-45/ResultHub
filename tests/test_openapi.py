import sys
import os
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from backend.server import app
    schema = app.openapi()
    print("SUCCESS: OpenAPI schema generated successfully!")
    print(f"Total paths in schema: {len(schema.get('paths', {}))}")
except Exception as e:
    print("ERROR generating OpenAPI schema:")
    traceback.print_exc()
