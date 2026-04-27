from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from groq import Groq
from dotenv import load_dotenv
import os
import uuid

from backend.database import engine, get_db, Base
from backend import models
import schemas

load_dotenv()

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Unfiltered AI")

# Allow frontend to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Grok API client — uses OpenAI-compatible SDK

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# This is the HEART of the project — the unfiltered system prompt
SYSTEM_PROMPT = """You are Unfiltered AI — a brutally honest assistant built to act as a mirror.

Your core mission: show users the raw, unvarnished truth about their situation and give them real, actionable paths forward. You are the antidote to AI sycophancy.

RULES — follow these without exception:
1. NEVER sugarcoat, give hollow validation, or say things like "great question!" or "you're doing amazing!"
2. If the user's plan, idea, or thinking has flaws — name them clearly and specifically
3. If the user is making excuses or lying to themselves — call it out directly but without being cruel
4. Always pair truth with utility: brutal honesty + concrete solution
5. Identify the REAL problem beneath what the user is saying, not just the surface-level question
6. Give grounded, realistic advice — not motivational fluff or generic tips
7. Be direct. Be specific. Be useful.
8. Never pad your response with filler. Get to the point fast.

RESPONSE FORMAT (use this structure):
🔍 Reality Check: [what is actually going on, no filter]
⚠️ The Real Problem: [the deeper issue the user may be avoiding]
✅ What To Actually Do: [numbered, specific, actionable steps]

You are not a bully. You are a trusted advisor who respects users enough to tell them the truth.
Users come to you because they are tired of being told what they want to hear."""


@app.post("/session", response_model=schemas.NewSession)
def create_session(db: Session = Depends(get_db)):
    session_id = str(uuid.uuid4())
    conversation = models.Conversation(session_id=session_id)
    db.add(conversation)
    db.commit()
    return {"session_id": session_id}


@app.post("/chat", response_model=schemas.ChatResponse)
def chat(request: schemas.ChatRequest, db: Session = Depends(get_db)):
    # Find or create conversation
    conversation = db.query(models.Conversation).filter(
        models.Conversation.session_id == request.session_id
    ).first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Session not found. Create a session first.")

    # Load previous messages for context
    history = db.query(models.Message).filter(
        models.Message.conversation_id == conversation.id
    ).order_by(models.Message.created_at).all()

    # Build message list for API
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.message})

    # Call Grok API
    try:
        response = client.chat.completions.create(
           model="llama-3.3-70b-versatile",
            messages=messages,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grok API error: {str(e)}")

    # Save user message and AI reply to DB
    db.add(models.Message(conversation_id=conversation.id, role="user", content=request.message))
    db.add(models.Message(conversation_id=conversation.id, role="assistant", content=reply))
    db.commit()

    return {"session_id": request.session_id, "reply": reply}


@app.get("/history/{session_id}")
def get_history(session_id: str, db: Session = Depends(get_db)):
    conversation = db.query(models.Conversation).filter(
        models.Conversation.session_id == session_id
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.query(models.Message).filter(
        models.Message.conversation_id == conversation.id
    ).order_by(models.Message.created_at).all()

    return {"messages": [{"role": m.role, "content": m.content} for m in messages]}


@app.get("/")
def root():
    return {"status": "Unfiltered AI backend running"}