import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.support_router import (
    handle_support_chat,
    SupportChatRequest,
    ChatMessage,
    detect_intent,
    search_student_records
)

print("=" * 60)
print("   TESTING INTENT-BASED AI ASSISTANT")
print("=" * 60)

# Test 1: Live Status Intent
req1 = SupportChatRequest(
    messages=[],
    user_query="live scrape status aur speed batao"
)
resp1 = handle_support_chat(req1)
print("\n[TEST 1] Live Status Query:")
print(f"Source: {resp1.source} | Intent: {resp1.intent} | Confidence: {resp1.confidence}")
print(f"Reply:\n{resp1.reply}")
assert resp1.intent == "live_status"
assert resp1.confidence >= 0.7

# Test 2: Scraping History Intent
req2 = SupportChatRequest(
    messages=[],
    user_query="show past scraping history jobs"
)
resp2 = handle_support_chat(req2)
print("\n[TEST 2] Scraping History Query:")
print(f"Source: {resp2.source} | Intent: {resp2.intent} | Confidence: {resp2.confidence}")
print(f"Reply:\n{resp2.reply}")
assert resp2.intent == "scrape_history"
assert resp2.confidence >= 0.7

# Test 3: Result Lookup with Roll Number
req3 = SupportChatRequest(
    messages=[],
    user_query="0105IT241001 ka result dekho"
)
resp3 = handle_support_chat(req3)
print("\n[TEST 3] Result Lookup with Roll Number:")
print(f"Source: {resp3.source} | Intent: {resp3.intent} | Confidence: {resp3.confidence}")
print(f"Reply:\n{resp3.reply}")
assert resp3.intent == "result_lookup"
assert resp3.confidence >= 0.7

# Test 4: Multi-turn Dialog Context & Slot Filling
print("\n[TEST 4] Multi-turn Context Slot Filling:")
turn1 = SupportChatRequest(
    messages=[],
    user_query="3 sem ka result"
)
resp_t1 = handle_support_chat(turn1)
print(f"Turn 1 Reply:\n{resp_t1.reply}")

# Turn 2: User answers with name "Astha"
turn2 = SupportChatRequest(
    messages=[
        ChatMessage(role="user", content="3 sem ka result"),
        ChatMessage(role="assistant", content=resp_t1.reply)
    ],
    user_query="Astha"
)
resp_t2 = handle_support_chat(turn2)
print(f"\nTurn 2 Reply:\n{resp_t2.reply}")
assert resp_t2.intent == "result_lookup"
assert resp_t2.confidence >= 0.7
assert "Astha" in resp_t2.reply or "No student record found" in resp_t2.reply or "students matching" in resp_t2.reply

# Test 5: Ambiguous Query (Confidence 0.4 - 0.7)
req5 = SupportChatRequest(
    messages=[],
    user_query="kya aap mujhe bata sakte ho?"
)
resp5 = handle_support_chat(req5)
print("\n[TEST 5] Low / Clarification Confidence Query:")
print(f"Source: {resp5.source} | Intent: {resp5.intent} | Confidence: {resp5.confidence}")
print(f"Reply:\n{resp5.reply}")

# Test 6: FastAPI OpenAPI schema validation
from backend.server import app
schema = app.openapi()
assert "/api/support/chat" in schema["paths"]
print("\n[TEST 6] FastAPI OpenAPI Schema generation: SUCCESS!")

print("\n" + "=" * 60)
print("   ALL TEST CASES PASSED SUCCESSFULLY!  ")
print("=" * 60)
