from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import re
import os
import requests
from dotenv import load_dotenv
from transformers import pipeline
from sentence_transformers import SentenceTransformer
from fastapi.responses import StreamingResponse
import json

# --------------------------------------------------
# Setup
# --------------------------------------------------
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

app = FastAPI(title="FloatChat NLP Service", version="1.0")

# --------------------------------------------------
# Local NLP Models
# --------------------------------------------------
sentiment_pipe = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english"
)

# Removed topic_pipe because it was unused and takes 1.6GB of RAM, crashing the 1GB server.

embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

# --------------------------------------------------
# Helpers
# --------------------------------------------------
def extract_keywords(text: str, k: int = 6) -> List[str]:
    words = re.findall(r"[a-zA-Z0-9]+", text.lower())
    stop = {
        "i","me","my","we","you","your","is","am","are","was","were",
        "a","an","the","to","of","in","on","for","and","or","but","with",
        "at","from","this","that","it","as","be","by","do","does","did",
        "not","so","if"
    }

    freq = {}
    for w in words:
        if w in stop or len(w) <= 2:
            continue
        freq[w] = freq.get(w, 0) + 1

    return [w for w, _ in sorted(freq.items(), key=lambda x: x[1], reverse=True)[:k]]


def detect_intent(text: str) -> str:
    t = text.lower()

    if any(w in t.split() for w in ["hi", "hello", "hey"]):
        return "greeting"
    if "?" in t:
        return "question"
    if any(w in t for w in ["help", "support"]):
        return "support"
    if any(w in t for w in ["issue", "problem", "complaint"]):
        return "complaint"

    return "other"


# --------------------------------------------------
# Schemas
# --------------------------------------------------
class AnalyzeRequest(BaseModel):
    text: str


class AnalyzeResponse(BaseModel):
    sentiment: str
    topic: str
    intent: str
    keywords: List[str]
    smart_replies: List[str]
    embedding: List[float]


class SummarizeRequest(BaseModel):
    texts: List[str]


# --------------------------------------------------
# Routes
# --------------------------------------------------

@app.get("/")
def health_check():
    return {"status": "healthy"}

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    text = req.text.strip()
    
    # 🔹 Run sentiment and basic tasks
    sent = sentiment_pipe(text)[0]["label"].lower()
    intent = detect_intent(text)
    keywords = extract_keywords(text)
    embedding = embedder.encode(text).tolist()

    # 🔹 Use Groq for Smart Replies and Topic (Better accuracy)
    smart_replies = []
    topic = "general"
    
    try:
        # We only generate smart replies for short-ish user inputs
        if len(text) < 300:
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {
                            "role": "system", 
                            "content": "You are generating follow-up suggestions for a chat app. Based on the user's message, generate 3 short follow-up questions or statements the USER might want to explicitly ask or say next. Output ONLY a valid JSON list of strings."
                        },
                        {"role": "user", "content": text}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 50
                }
            )
            data = res.json()
            raw_content = data["choices"][0]["message"]["content"]
            
            # 🔹 Advanced JSON extraction
            # Try to find list directly
            match = re.search(r"\[.*\]", raw_content, re.DOTALL)
            if match:
                smart_replies = json.loads(match.group())
            else:
                # Try parsing the whole thing if it's just a JSON string
                try:
                    smart_replies = json.loads(raw_content)
                except:
                    pass
    except Exception as e:
        print("NLP Groq Error:", str(e))

    return {
        "sentiment": sent,
        "topic": topic,
        "intent": intent,
        "keywords": keywords,
        "smart_replies": smart_replies,
        "embedding": embedding
    }


@app.post("/embed")
def embed(payload: dict):
    text = payload.get("text", "")
    if not text:
        return {"embedding": []}
    return {"embedding": embedder.encode(text).tolist()}


@app.post("/summarize")
def summarize(req: SummarizeRequest):
    joined = " ".join(req.texts)

    try:
        res = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [
                    {"role": "system", "content": "Summarize this conversation clearly."},
                    {"role": "user", "content": joined}
                ],
                "temperature": 0.2,
                "max_tokens": 150
            }
        )

        summary = res.json()["choices"][0]["message"]["content"]
        return {"summary": summary}

    except:
        return {"summary": joined[:200] + "..."}


@app.post("/generate")
async def generate_text(data: dict):

    prompt = data.get("prompt", "")
    history = data.get("history", [])
    summary = data.get("summary")
    recalled = data.get("recalled", [])
    intent = data.get("intent")
    image_url = data.get("imageUrl")

    if not prompt and not image_url:
        return {"response": ""}

    messages = [
        {
            "role": "system",
            "content": """
You are an intelligent, helpful, and precise assistant.

Rules:
- Be thorough. If the user asks multiple questions, answer ALL of them in detail.
- If a question is ambiguous, ask a clarification question.
- Do NOT assume missing details.
- Only answer based on known information or general knowledge.
- Keep answers professional yet engaging.
"""
        }
    ]

    if summary:
        messages.append({
            "role": "system",
            "content": f"Conversation summary: {summary}"
        })

    if recalled:
        recall_text = "\n".join(
            [f"{m['role']}: {m['content']}" for m in recalled]
        )
        messages.append({
            "role": "system",
            "content": f"Relevant past discussion:\n{recall_text}"
        })

    for msg in history:
        messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    if image_url:
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": prompt if prompt else "Please analyze this image."},
                {"type": "image_url", "image_url": {"url": image_url}}
            ]
        })
    else:
        messages.append({
            "role": "user",
            "content": prompt
        })

    model_name = "llama-3.2-11b-vision-preview" if image_url else "llama-3.1-8b-instant"

    def stream_response():
        try:
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model_name,
                    "messages": messages,
                    "temperature": 0.4,
                    "max_tokens": 300,
                    "stream": True
                },
                stream=True
            )

            for line in response.iter_lines():
                if line:
                    decoded = line.decode("utf-8")

                    if decoded.startswith("data: "):
                        chunk = decoded.replace("data: ", "")

                        if chunk == "[DONE]":
                            break

                        try:
                            data = json.loads(chunk)
                            content = data["choices"][0]["delta"].get("content")
                            if content:
                                yield content
                        except:
                            continue

        except Exception as e:
            yield "AI service unavailable."

    return StreamingResponse(stream_response(), media_type="text/plain")

@app.post("/generate-title")
async def generate_title(data: dict):
    prompt = data.get("prompt", "")

    if not prompt:
        return {"title": "New Chat"}

    try:
        res = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [
                    {
                        "role": "system",
                        "content": "Generate a very short 4-6 word chat title."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.3,
                "max_tokens": 20
            }
        )

        title = res.json()["choices"][0]["message"]["content"]
        return {"title": title.strip()}

    except Exception as e:
        print("Title generation error:", str(e))
        return {"title": "New Chat"}
