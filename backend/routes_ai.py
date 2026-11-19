import json
import os
import litellm
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()
router = APIRouter()

class AIChatRequest(BaseModel):
    message: str = ""
    prompt: str = ""
    system_prompt: str | None = None
    model: str | None = None
    history: list[dict] | None = None

def _build_messages(req: AIChatRequest) -> list[dict]:
    user_text = (req.message or req.prompt or "").strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Message or prompt is required")
    msgs: list[dict] = []
    if req.system_prompt:
        msgs.append({"role": "system", "content": req.system_prompt})
    if req.history:
        for turn in req.history:
            role = turn.get("role")
            content = turn.get("content")
            if role in ("user", "assistant", "system") and content:
                msgs.append({"role": role, "content": content})
    msgs.append({"role": "user", "content": user_text})
    return msgs

@router.post("/ai/chat")
@router.post("/chat")
async def ai_chat(req: AIChatRequest):
    messages = _build_messages(req)
    model = req.model or os.getenv("AI_MODEL", "gemini/gemini-2.5-flash")
    try:
        res = await litellm.acompletion(model=model, messages=messages)
        reply = res.choices[0].message.content
        return {"reply": reply, "response": reply, "message": reply, "model": model}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/ai/stream")
@router.post("/chat/stream")
async def ai_stream(req: AIChatRequest):
    messages = _build_messages(req)
    model = req.model or os.getenv("AI_MODEL", "gemini/gemini-2.5-flash")
    async def event_stream():
        try:
            stream = await litellm.acompletion(model=model, messages=messages, stream=True)
            async for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield f"data: {json.dumps({'type': 'delta', 'text': delta})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")
