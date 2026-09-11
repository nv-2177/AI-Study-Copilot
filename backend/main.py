import os
import json
import time
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from google import genai
from database import Base, engine
from models import Conversation, Message
from fastapi import Depends
from sqlalchemy.orm import Session
from database import SessionLocal
from datetime import datetime


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
Base.metadata.create_all(bind=engine)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
#-------------------------------
# 4. Dependency to get DB session
#-------------------------------

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@app.post("/conversations")
def create_conversation(db: Session = Depends(get_db)):
    conversation = Conversation(
        title="New Conversation"
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return {
        "id": conversation.id,
        "title": conversation.title
    }
@app.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conversation:
        return {
            "error": "Conversation not found"
        }

    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at).all()

    return {
        "id": conversation.id,
        "title": conversation.title,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content
            }
            for message in messages
        ]
    }
@app.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conversation:
        return {
            "error": "Conversation not found"
        }

    db.delete(conversation)
    db.commit()

    return {
        "message": "Conversation deleted",
        "conversation_id": conversation_id
    }


# --------------------------------
# 5. Request model
# --------------------------------

class ChatRequest(BaseModel):
    message: str
    conversation_id: int
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
        model="gemini-3.5-flash",
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
@app.post("/chat/stream")
def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == request.conversation_id
    ).first()

    if not conversation:
        return {
            "error": "Conversation not found"
        }

    user_message = Message(
        conversation_id=request.conversation_id,
        role="user",
        content=request.message
    )
    db.add(user_message)
    if conversation.title == "New Conversation":
        conversation.title = request.message[:50]
    db.commit()

    previous_messages = db.query(Message).filter(
        Message.conversation_id == request.conversation_id
    ).order_by(Message.created_at).all()

    conversation_text = ""

    for message in previous_messages:
        conversation_text += (
            f"{message.role}: {message.content}\n"
        )

    prompt = f"""
The following is the conversation between the student and AI Study Copilot.

Conversation:
{conversation_text}

Answer the student's latest question.

Requirements:
- Explain clearly.
- Start with intuition when appropriate.
- Give examples when useful.
- Keep the answer suitable for a learner.
- Respond as natural text.
"""

    def generate():
        full_response = ""

        try:
            response = client.models.generate_content_stream(
                model="gemini-3.5-flash",
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
"""
                },
                contents=prompt
            )

            for chunk in response:
                if chunk.text:
                    full_response += chunk.text
                    yield chunk.text

            assistant_message = Message(
                conversation_id=request.conversation_id,
                role="assistant",
                content=full_response
            )

            db.add(assistant_message)

            conversation.updated_at = datetime.utcnow()

            db.commit()

        except Exception as error:
            print("Gemini error:", error)

            db.rollback()

            yield "\n\nSorry, I couldn't generate a response right now."

    return StreamingResponse(
        generate(),
        media_type="text/plain"
    )
@app.get("/conversations")
def get_conversations(
    db: Session = Depends(get_db)
):
    conversations = db.query(Conversation).order_by(
        Conversation.updated_at.desc()
    ).all()

    return [
        {
            "id": conversation.id,
            "title": conversation.title,
            "created_at": conversation.created_at,
            "updated_at": conversation.updated_at
        }
        for conversation in conversations
    ]