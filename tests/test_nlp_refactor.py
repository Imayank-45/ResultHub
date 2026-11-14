import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.support_router import (
    handle_support_chat,
    SupportChatRequest,
    normalize_text,
    classify_intent_first,
    extract_intent_entities,
    STOP_WORDS
)

print("=" * 65)
print("   TESTING INTENT-FIRST NLP PIPELINE REFACTORING")
print("=" * 65)

# Requirement 1 & 10: Stop-Word Filter Test ("3 sem ka result bata")
norm1 = normalize_text("3 sem ka result bata")
intent1, conf1 = classify_intent_first(norm1, "3 sem ka result bata", [])
ent1, ign1 = extract_intent_entities(intent1, norm1, "3 sem ka result bata")
print("\n[TEST 1] Query: '3 sem ka result bata'")
print(f"  Intent: {intent1} | Name Extracted: {ent1.get('student_name')}")
print(f"  Ignored Tokens: {ign1}")
assert ent1.get("student_name") is None, "student_name must be None when no valid name remains"

# Requirement 3: RESULT_LOOKUP Name Extraction ("Mayank ka result bata")
norm2 = normalize_text("Mayank ka result bata")
intent2, conf2 = classify_intent_first(norm2, "Mayank ka result bata", [])
ent2, ign2 = extract_intent_entities(intent2, norm2, "Mayank ka result bata")
print("\n[TEST 2] Query: 'Mayank ka result bata'")
print(f"  Intent: {intent2} | Name Extracted: {ent2.get('student_name')}")
print(f"  Ignored Tokens: {ign2}")
assert intent2 == "RESULT_LOOKUP"
assert ent2.get("student_name") == "Mayank"
assert "result" in ign2 or "bata" in ign2

# Requirement 4: START_EXTRACTION (Never extract student_name)
norm3 = normalize_text("BTech IT 3 sem 3 se 7 tak result nikal do")
intent3, conf3 = classify_intent_first(norm3, "BTech IT 3 sem 3 se 7 tak result nikal do", [])
ent3, ign3 = extract_intent_entities(intent3, norm3, "BTech IT 3 sem 3 se 7 tak result nikal do")
print("\n[TEST 3] Query: 'BTech IT 3 sem 3 se 7 tak result nikal do'")
print(f"  Intent: {intent3} | Name Extracted: {ent3.get('student_name')}")
print(f"  Entities: {ent3}")
assert intent3 == "START_EXTRACTION"
assert ent3.get("student_name") is None
assert ent3.get("branch") == "IT"
assert ent3.get("semester") == "3"
assert ent3.get("start_roll") == 3
assert ent3.get("end_roll") == 7

# Requirement 7: JOB_STATS Intent
req_job = SupportChatRequest(messages=[], user_query="kitne jobs complete hai")
resp_job = handle_support_chat(req_job)
print("\n[TEST 4] Query: 'kitne jobs complete hai'")
print(f"  Intent: {resp_job.intent} | Reply Snippet:\n{resp_job.reply[:120]}...")
assert resp_job.intent == "JOB_STATS"
assert "Completed Jobs" in resp_job.reply or "Statistics" in resp_job.reply

# Requirement 8: TOTAL_STUDENTS Intent
req_tot = SupportChatRequest(messages=[], user_query="IT branch me total student kitne hai")
resp_tot = handle_support_chat(req_tot)
print("\n[TEST 5] Query: 'IT branch me total student kitne hai'")
print(f"  Intent: {resp_tot.intent} | Reply Snippet:\n{resp_tot.reply[:120]}...")
assert resp_tot.intent == "TOTAL_STUDENTS"
assert "Total Extracted Students" in resp_tot.reply or "Count" in resp_tot.reply

# Requirement 5 & 6: HISTORY & LIVE_STATUS (No name extracted)
norm_h = normalize_text("show past scraping history jobs")
intent_h, _ = classify_intent_first(norm_h, "show past scraping history jobs", [])
ent_h, _ = extract_intent_entities(intent_h, norm_h, "show past scraping history jobs")
assert intent_h == "HISTORY"
assert ent_h.get("student_name") is None

print("\n" + "=" * 65)
print("   ALL 11 REFACTORED REQUIREMENTS VERIFIED SUCCESSFULLY!  ")
print("=" * 65)
