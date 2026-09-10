import os
import json
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from google import genai


# --------------------------------
# 1. Load environment variables
# --------------------------------

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY is not set in the .env file")


# --------------------------------
# 2. Create Gemini client
# --------------------------------

client = genai.Client(api_key=api_key)


# --------------------------------
# 3. Create FastAPI application
# --------------------------------

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------
# 4. Temporary conversation history
# --------------------------------

conversation_history = []


# --------------------------------
# 5. Request model
# --------------------------------

class ChatRequest(BaseModel):
    message: str
class StudyResponse(BaseModel):
    topic: str
    difficulty: str
    explanation: str
    key_points: List[str]

# --------------------------------
# 6. Home endpoint
# --------------------------------

@app.get("/")
def home():
    return {
        "message": "AI Study Copilot backend is running"
    }


# --------------------------------
# 7. Chat endpoint
# --------------------------------
@app.delete("/chat")
def clear_chat():
    conversation_history.clear()

    return {
        "message": "Conversation cleared"
    }
@app.post("/chat")
def chat(request: ChatRequest):
    conversation_history.append({
        "role": "user",
        "content": request.message
    })

    conversation_text = ""
    for message in conversation_history:
        conversation_text += (
            f"{message['role']}: {message['content']}\n"
        )

    prompt = f"""
The following is the conversation between the student and AI Study Copilot.

Conversation:
{conversation_text}

Answer the student's latest question.

Return:
- topic: the main topic being discussed
- difficulty: beginner, intermediate, or advanced
- explanation: a clear explanation suitable for the student
- key_points: 3 to 5 important points

Requirements:
- Explain clearly.
- Start with intuition when appropriate.
- Give examples when useful.
- Keep the answer suitable for a learner.
"""

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        config={
            "system_instruction": """
You are AI Study Copilot, an AI assistant designed to help students learn.

Your goals:
- Explain concepts clearly and simply.
- Start with intuition before technical details.
- Use examples when useful.
- If the user asks about programming, explain the idea before giving code.
- Do not unnecessarily make answers complicated.
- If the user seems confused, simplify the explanation.
""",
            "response_mime_type": "application/json",
            "response_schema": StudyResponse,
        },
        contents=prompt
    )

    ai_response = json.loads(response.text)


    conversation_history.append({
        "role": "assistant",
        "content": json.dumps(ai_response)
    })

    return ai_response