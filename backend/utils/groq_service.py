import os
import json
import urllib.request
import urllib.error
import logging
from typing import List, Dict, Any, Optional

try:
    from backend.utils.env_loader import load_dotenv
except ImportError:
    from .env_loader import load_dotenv

logger = logging.getLogger("result_ai.groq_service")

SYSTEM_PROMPT = """You are ResultAI's intelligent AI Assistant. You answer general questions, academic topics, programming queries, and conversational chat in English, Hindi, or Hinglish clearly, accurately, and politely.

STRICT BOUNDARY RULES:
1. Do NOT fabricate, invent, or guess student results, grades, SGPA/CGPA, or roll numbers.
2. If the user asks to look up a student's result, find a roll number, or run a scraping job, guide them to use ResultAI commands (e.g. '0105IT241001 ka result', 'Ayush ka roll number', or 'BTech IT 3 sem 1 se 60 tak nikal do').
3. You CANNOT directly execute database mutations, delete records, or start backend scraping jobs.
4. Keep answers concise, helpful, and well-formatted with markdown."""

class GroqService:
    def __init__(self):
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"

    @property
    def api_key(self) -> str:
        key = os.getenv("GROQ_API_KEY", "").strip()
        if not key or key == "gsk_your_api_key_here":
            load_dotenv(force_reload=True)
            key = os.getenv("GROQ_API_KEY", "").strip()
        return key if key != "gsk_your_api_key_here" else ""

    @property
    def model(self) -> str:
        model_name = os.getenv("GROQ_MODEL", "").strip()
        if not model_name:
            load_dotenv(force_reload=True)
            model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
        return model_name or "llama-3.3-70b-versatile"

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def generate_response(self, user_query: str, chat_history: Optional[List[Any]] = None) -> Dict[str, Any]:
        """
        Sends user query and recent chat history to Groq LLM API.
        Includes automatic model fallbacks and history sanitization.
        Returns dict: {"reply": str, "source": str}
        """
        if not self.is_configured():
            logger.info("Groq API key not set in .env. Returning smart guidance.")
            return self._get_smart_fallback(user_query)

        # Sanitize chat history (only keep short text content, strip huge UI card markup)
        formatted_messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        if chat_history:
            for msg in chat_history[-6:]:
                m_role = getattr(msg, "role", None) or (msg.get("role") if isinstance(msg, dict) else "user")
                m_content = getattr(msg, "content", None) or (msg.get("content") if isinstance(msg, dict) else "")
                
                # Ignore UI system banners / job cards
                if "Scraping in Progress" in m_content or "Offline Support Response" in m_content or "Scraping Completed" in m_content:
                    continue

                role = "assistant" if m_role in ["assistant", "model"] else "user"
                clean_text = m_content.strip()
                if clean_text:
                    if len(clean_text) > 400:
                        clean_text = clean_text[:400] + "..."
                    formatted_messages.append({"role": role, "content": clean_text})

        # Ensure current user_query is the final user message
        if not formatted_messages or formatted_messages[-1]["content"] != user_query:
            formatted_messages.append({"role": "user", "content": user_query})

        # Candidate model cascade list
        candidate_models = [self.model, "llama-3.3-70b-versatile", "llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768"]
        unique_models = []
        for m in candidate_models:
            if m and m not in unique_models:
                unique_models.append(m)

        for model_name in unique_models:
            payload = {
                "model": model_name,
                "messages": formatted_messages,
                "temperature": 0.7,
                "max_tokens": 1024
            }

            try:
                req_data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    self.api_url,
                    data=req_data,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "User-Agent": "ResultAI-SupportBot/1.0"
                    },
                    method="POST"
                )

                with urllib.request.urlopen(req, timeout=10) as response:
                    if response.status == 200:
                        res_body = json.loads(response.read().decode("utf-8"))
                        choices = res_body.get("choices", [])
                        if choices and "message" in choices[0] and "content" in choices[0]["message"]:
                            reply_text = choices[0]["message"]["content"].strip()
                            return {
                                "reply": reply_text,
                                "source": "ai"
                            }
            except urllib.error.HTTPError as e:
                logger.warning(f"Groq API HTTP {e.code} for model {model_name}. Trying next candidate model...")
                continue
            except Exception as e:
                logger.warning(f"Groq API call exception for model {model_name}: {e}")
                continue

        # If all API calls fail or timeout, fall back to smart local QA
        return self._get_smart_fallback(user_query)

    def _get_smart_fallback(self, query: str) -> Dict[str, Any]:
        """Provides an intelligent local academic response when Groq API is offline or unconfigured."""
        q_lower = query.lower()

        if "schema" in q_lower:
            reply = (
                "📚 **Database Schema Definition**:\n\n"
                "A **Database Schema** is the structural blueprint of a relational database that defines how data is organized, stored, and related.\n\n"
                "**Key Schema Concepts**:\n"
                "- **Logical Schema**: Defines database objects like tables, columns, data types, primary/foreign keys, and constraints.\n"
                "- **Physical Schema**: Describes how data is physically laid out on disk storage files.\n"
                "- **Database Instance**: The actual snapshot of data stored in the database at a specific moment in time.\n\n"
                "💡 *Example*: In ResultAI, the student schema includes tables like `ScrapeJobHistory` with columns (`job_id`, `prefix`, `total_students`, `status`)."
            )
        elif "normalization" in q_lower or "normalisation" in q_lower:
            reply = (
                "📚 **Database Normalization Explanation**:\n\n"
                "Database normalization is the process of structuring a relational database to reduce data redundancy and improve data integrity.\n\n"
                "**Key Normal Forms (NF)**:\n"
                "- **1NF**: Ensures each table cell contains atomic (indivisible) values and each record is unique.\n"
                "- **2NF**: Meets 1NF requirements and eliminates partial dependencies (non-key columns depend on full primary key).\n"
                "- **3NF**: Meets 2NF requirements and eliminates transitive dependencies (non-key columns depend only on primary key).\n"
                "- **BCNF**: A stricter version of 3NF for multi-key dependencies."
            )
        elif any(k in q_lower for k in ["dbms", "sql", "relational", "primary key", "foreign key", "er diagram", "table", "join"]):
            reply = (
                "💻 **Database Management System (DBMS) Overview**:\n\n"
                "A DBMS is software used to define, create, maintain, and control access to databases.\n\n"
                "**Core Concepts**:\n"
                "- **Primary Key**: A unique identifier for each record in a table.\n"
                "- **Foreign Key**: A column establishing a link between data in two tables.\n"
                "- **SQL (Structured Query Language)**: Standard language for querying and managing relational databases.\n"
                "- **ACID Properties**: Atomicity, Consistency, Isolation, Durability for reliable database transactions."
            )
        elif "result" in q_lower or "sgpa" in q_lower or "cgpa" in q_lower:
            reply = (
                "🔍 **Result Search Assistance**:\n\n"
                "You can search for any RGPV student result directly in ResultAI:\n"
                "- Type a roll number: e.g. `0105IT241001`\n"
                "- Search by student name: e.g. `Ayush ka result`\n"
                "- Start a batch extraction: e.g. `BTech IT 3 sem 1 se 60 tak nikal do`"
            )
        elif "define" in q_lower or "explain" in q_lower or "what is" in q_lower:
            subject = query.replace("define", "").replace("explain", "").replace("what is", "").replace("?", "").strip()
            subject_title = subject.title() if subject else "Topic"
            reply = (
                f"📖 **Definition & Overview: {subject_title}**\n\n"
                f"**{subject_title}** is a core concept in computer science and engineering.\n\n"
                f"👉 **Key Takeaways**:\n"
                f"- Serves as a foundational element in database design, software architecture, or algorithms.\n"
                f"- Focuses on structural clarity, data integrity, and system efficiency.\n\n"
                f"💡 *Tip*: You can set an active `GROQ_API_KEY` in `.env` to generate live LLM responses for any general Q&A!"
            )
        else:
            reply = (
                f"🤖 **ResultAI Knowledge Assistant**\n\n"
                f"I am ready to help you with academic topics, RGPV exam result searches, and batch extractions!\n\n"
                f"💡 **Suggested Prompts**:\n"
                f"- `define schema` (DBMS Concept)\n"
                f"- `0105IT241001 ka result` (Single Student Search)\n"
                f"- `BTech IT 3 sem 1 se 30 tak nikal do` (Batch Extraction)\n"
                f"- `Explain Database Normalization` (Academic Concept)"
            )

        return {
            "reply": reply,
            "source": "ai_fallback"
        }

# Singleton instance
groq_service = GroqService()
