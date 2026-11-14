import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.server import app, update_queue, ScrapeJobRunner, active_runner
from backend.support_router import handle_support_chat, SupportChatRequest

print("=" * 65)
print("   TESTING REAL-TIME SYNCHRONIZATION ARCHITECTURE")
print("=" * 65)

# Test 1: Verify enriched status payload schema
runner = ScrapeJobRunner(
    prefix="0105IT2410",
    start=1,
    end=5,
    pad=2,
    sem="3",
    program="B.Tech."
)

status_dict = runner.get_status_dict()
print("\n[TEST 1] Single Source of Truth Status Payload:")
print(f"  Job ID       : {status_dict.get('job_id')}")
print(f"  Prefix       : {status_dict.get('prefix')}")
print(f"  Roll Range   : {status_dict.get('start')} to {status_dict.get('end')}")
print(f"  Program/Sem  : {status_dict.get('program')} / Sem {status_dict.get('sem')}")
print(f"  Status       : {status_dict.get('status')}")

assert status_dict.get("prefix") == "0105IT2410"
assert status_dict.get("start") == 1
assert status_dict.get("end") == 5
assert status_dict.get("job_id") is not None

# Test 2: Chatbot START_EXTRACTION triggers runner & emits WebSocket payload
req = SupportChatRequest(
    messages=[],
    user_query="1 se 5 tak result nikal IT, third sem BTech ka"
)

resp = handle_support_chat(req)

print("\n[TEST 2] Chatbot Extraction Trigger & Broadcast:")
print(f"  Intent: {resp.intent} | Source: {resp.source}")

assert resp.intent == "START_EXTRACTION"

# Check update_queue for emitted WebSocket broadcast message
broadcast_msg = None
while not update_queue.empty():
    msg = update_queue.get_nowait()
    if msg.get("type") == "status":
        broadcast_msg = msg.get("data")
        break

assert broadcast_msg is not None, "WebSocket update_queue must receive status broadcast"
print("\n[TEST 3] WebSocket Broadcast Data Received:")
print(f"  Prefix       : {broadcast_msg.get('prefix')}")
print(f"  Start Roll   : {broadcast_msg.get('start')}")
print(f"  End Roll     : {broadcast_msg.get('end')}")
print(f"  Status       : {broadcast_msg.get('status')}")
assert broadcast_msg.get("prefix") == "0105IT2410"

print("\n" + "=" * 65)
print("   REAL-TIME SYNCHRONIZATION TEST PASSED SUCCESSFULLY!  ")
print("=" * 65)
