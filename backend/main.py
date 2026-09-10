import os
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
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

@app.post("/chat")
def chat(request: ChatRequest):

    # Add user's message to history
    conversation_history.append({
        "role": "user",
        "content": request.message
    })

    # Create conversation text for Gemini
    conversation_text = ""

    for message in conversation_history:
        conversation_text += (
            f"{message['role']}: {message['content']}\n"
        )

    # Send conversation to Gemini
    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=conversation_text
    )

    # Get AI response
    ai_response = response.text

    # Add AI response to history
    conversation_history.append({
        "role": "assistant",
        "content": ai_response
    })

    return {
        "response": ai_response
    }