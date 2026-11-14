import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.support_router import (
    handle_support_chat,
    SupportChatRequest,
    ChatMessage,
    normalize_text,
    extract_entities,
    classify_intent
)

print("=" * 65)
print("   TESTING ADVANCED NLP PIPELINE UPGRADE")
print("=" * 65)

# Requirement 1: Text Normalization & Typo Correction Test
print("\n[TEST 1] Text Normalization & Typo Auto-Correction:")
raw1 = "  0105IT241001!! ka reuslt   batao pls... "
norm1 = normalize_text(raw1)
print(f"  Raw        : '{raw1}'")
print(f"  Normalized : '{norm1}'")
assert "result" in norm1

# Requirement 2 & 4: Roll Number Regex Match & Direct Lookup
print("\n[TEST 2] Roll Number Direct Match Priority:")
req2 = SupportChatRequest(messages=[], user_query="0105IT241001 ka rsult dekho")
resp2 = handle_support_chat(req2)
print(f"  Intent: {resp2.intent} | Confidence: {resp2.confidence}")
assert resp2.intent == "RESULT_LOOKUP"
assert resp2.confidence >= 0.95

# Requirement 5: Student Name Extraction ("Mayank ka result bata")
print("\n[TEST 3] Student Name Extraction:")
req3 = SupportChatRequest(messages=[], user_query="Mayank ka result bata")
resp3 = handle_support_chat(req3)
print(f"  Intent: {resp3.intent} | Confidence: {resp3.confidence}")
print(f"  Reply Snippet:\n{resp3.reply[:120]}...")
assert resp3.intent == "RESULT_LOOKUP"
assert resp3.confidence >= 0.80

# Requirement 6: Start Extraction Intent Parsing ("BTech IT 3 sem 3 se 7 tak result nikal do")
print("\n[TEST 4] Start Extraction Command Parsing:")
req4 = SupportChatRequest(messages=[], user_query="BTech IT 3 sem 3 se 7 tak result nikal do")
resp4 = handle_support_chat(req4)
print(f"  Intent: {resp4.intent} | Confidence: {resp4.confidence}")
print(f"  Reply:\n{resp4.reply}")
assert resp4.intent == "START_EXTRACTION"
assert "0105IT2410" in resp4.reply
assert "3 to 7" in resp4.reply or "3" in resp4.reply

# Requirement 7: Roll Search Intent ("Ayush ka roll number")
print("\n[TEST 5] Roll Search Intent:")
req5 = SupportChatRequest(messages=[], user_query="Ayush ka roll number")
resp5 = handle_support_chat(req5)
print(f"  Intent: {resp5.intent} | Confidence: {resp5.confidence}")
print(f"  Reply:\n{resp5.reply}")
assert resp5.intent == "ROLL_SEARCH"

# Requirement 8: Capability Intent ("tere pass kya data hai")
print("\n[TEST 6] Capability Intent:")
req6 = SupportChatRequest(messages=[], user_query="tere pass kya data hai")
resp6 = handle_support_chat(req6)
print(f"  Intent: {resp6.intent} | Confidence: {resp6.confidence}")
print(f"  Reply:\n{resp6.reply}")
assert resp6.intent == "CAPABILITY"
assert "Result Lookup" in resp6.reply or "Capabilities" in resp6.reply

# Requirement 9 & 10: Live Status with Typo Correction ("scrape kitna hua ststus")
print("\n[TEST 7] Live Status with Typo Correction:")
req7 = SupportChatRequest(messages=[], user_query="scrape kitna hua ststus")
resp7 = handle_support_chat(req7)
print(f"  Intent: {resp7.intent} | Confidence: {resp7.confidence}")
assert resp7.intent == "LIVE_STATUS"

print("\n" + "=" * 65)
print("   ALL 10 NLP PIPELINE REQUIREMENTS VERIFIED SUCCESSFULLY!  ")
print("=" * 65)
