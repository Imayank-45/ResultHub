import sys
import os
import json
import unittest
from unittest.mock import patch, MagicMock

# Ensure root directory is on sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.support_router import (
    handle_support_chat,
    SupportChatRequest,
    ChatMessage
)
from backend.utils.groq_service import groq_service

class TestGroqChatbotIntegration(unittest.TestCase):

    def test_01_existing_intent_still_works(self):
        """1. Existing ResultAI intents (e.g. student result, live status) use existing handlers."""
        # Test Live Status Intent
        req_status = SupportChatRequest(messages=[], user_query="live status and speed")
        resp_status = handle_support_chat(req_status)
        self.assertEqual(resp_status.source, "intent_action")
        self.assertEqual(resp_status.intent, "LIVE_STATUS")
        self.assertTrue("Live Extraction Progress" in resp_status.reply or "No Scrape Job Active" in resp_status.reply)

        # Test Roll Result Lookup Intent
        req_roll = SupportChatRequest(messages=[], user_query="0105IT241001 ka result dekho")
        resp_roll = handle_support_chat(req_roll)
        self.assertEqual(resp_roll.source, "intent_action")
        self.assertEqual(resp_roll.intent, "RESULT_LOOKUP")

    def test_02_unknown_general_question_goes_to_groq(self):
        """2. Unknown / general questions go to Groq LLM fallback."""
        with patch.object(groq_service, 'generate_response') as mock_groq:
            mock_groq.return_value = {
                "reply": "Data Structures & Algorithms is a fundamental computer science subject focusing on organization and problem solving.",
                "source": "ai"
            }

            req = SupportChatRequest(messages=[], user_query="What is Data Structures & Algorithms?")
            resp = handle_support_chat(req)

            # Ensure Groq generate_response was called
            mock_groq.assert_called_once()
            self.assertEqual(resp.source, "ai")
            self.assertEqual(resp.intent, "GENERAL_QA")
            self.assertIn("Data Structures & Algorithms", resp.reply)

    def test_03_hindi_hinglish_question_works(self):
        """3. Hindi/Hinglish general questions route to Groq."""
        with patch.object(groq_service, 'generate_response') as mock_groq:
            mock_groq.return_value = {
                "reply": "Engineering padhai ke liye time management aur regular revision sabse zaroori hai.",
                "source": "ai"
            }

            req = SupportChatRequest(messages=[], user_query="Engineering ki tayari kaise karein?")
            resp = handle_support_chat(req)

            mock_groq.assert_called_once()
            self.assertEqual(resp.source, "ai")
            self.assertEqual(resp.intent, "GENERAL_QA")
            self.assertIn("Engineering", resp.reply)

    def test_04_groq_api_failure_handled_correctly(self):
        """4. Groq API failure / unconfigured state handled gracefully without crashing."""
        # Unconfigured / missing key fallback test
        with patch.object(groq_service, 'is_configured', return_value=False):
            req = SupportChatRequest(messages=[], user_query="Tell me about machine learning")
            resp = handle_support_chat(req)

            self.assertEqual(resp.source, "ai_fallback")
            self.assertIn("GROQ_API_KEY", resp.reply)

        # API exception fallback test
        with patch.object(groq_service, 'generate_response') as mock_groq:
            mock_groq.return_value = {
                "reply": "⚠️ **AI Service Offline**: Unable to connect to Groq LLM API.",
                "source": "ai_fallback"
            }

            req = SupportChatRequest(messages=[], user_query="Explain Operating Systems")
            resp = handle_support_chat(req)

            self.assertEqual(resp.source, "ai_fallback")
            self.assertIn("AI Service Offline", resp.reply)

    def test_05_api_key_never_exposed_to_frontend(self):
        """5. API key is never exposed to frontend in API responses."""
        with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_SECRET_KEY_TEST_12345"}):
            req = SupportChatRequest(messages=[], user_query="Who created Python?")
            resp = handle_support_chat(req)

            # Response dictionary / reply string must never contain secret API key
            resp_str = json.dumps(resp.model_dump())
            self.assertNotIn("gsk_SECRET_KEY_TEST_12345", resp_str)
            self.assertNotIn("GROQ_API_KEY", resp.reply)

def run_groq_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestGroqChatbotIntegration)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        sys.exit(1)

if __name__ == "__main__":
    run_groq_tests()
