import uuid
import json
import logging
import asyncio
import httpx
from typing import List, Dict, AsyncGenerator
from ai_engine.tools import determine_context

logger = logging.getLogger(__name__)

# Simple cache to store responses
chat_cache: Dict[str, str] = {}

def get_system_prompt(is_simple: bool) -> Dict[str, str]:
    if is_simple:
        return {
            "role": "system",
            "content": "You are Divu. Answer the user's question accurately and as briefly as possible. Do not include follow-up questions."
        }
    return {
        "role": "system", 
        "content": (
            "You are Divu, an elite enterprise AI Assistant. "
            "1. CHAIN OF VERIFICATION: Before answering complex questions, ensure your logic is verified and accurate. "
            "2. STRICT GROUNDING: If [System Info] real-time context is provided, you MUST base your answer strictly on that context. Do NOT hallucinate data outside the context. If the context contradicts your training, trust the context. "
            "3. TONE: Be professional, highly accurate, and concise. Format your output using markdown tables, bold text, and bullet points where helpful. "
            "4. FOLLOW-UPS: At the absolute end of EVERY response, you MUST generate 3 predictive follow-up questions the user might want to ask next. Format exactly like this:\n\n"
            "**Suggested Follow-ups:**\n"
            "1. [Question 1]?\n"
            "2. [Question 2]?\n"
            "3. [Question 3]?"
        )
    }

async def call_ollama(messages: List[Dict[str, str]], retries: int = 3) -> str:
    url = "http://localhost:11434/api/chat"
    async with httpx.AsyncClient(timeout=120.0) as client:
        for attempt in range(retries):
            try:
                response = await client.post(url, json={
                    "model": "gemma:2b",
                    "messages": messages,
                    "stream": False
                })
                
                if response.status_code == 200:
                    return response.json().get("message", {}).get("content", "").strip()
                elif response.status_code == 429:
                    wait_time = 2 ** attempt
                    logger.warning(f"Ollama returned 429. Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    response.raise_for_status()
            except httpx.RequestError as e:
                if attempt == retries - 1:
                    return f"Error: Failed to connect to Ollama. Details: {str(e)}"
                wait_time = 2 ** attempt
                logger.warning(f"Connection error. Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
                
    return "Error: Too many requests to LLM. Try again later."

async def stream_call_ollama(messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
    url = "http://localhost:11434/api/chat"
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json={
                "model": "gemma:2b",
                "messages": messages,
                "stream": True
            }) as response:
                if response.status_code == 200:
                    async for line in response.aiter_lines():
                        if line:
                            data = json.loads(line)
                            chunk = data.get("message", {}).get("content", "")
                            if chunk:
                                escaped = json.dumps(chunk)
                                yield f"data: {escaped[1:-1]}\n\n"
                    yield "data: [DONE]\n\n"
                else:
                    yield f"data: Error {response.status_code}\n\n"
    except asyncio.CancelledError:
        logger.warning("Stream cancelled by user.")
        raise
    except Exception as e:
        yield f"data: Error connecting to model: {str(e)}\n\n"

async def chat_stream_divu(message: str, history: List[Dict[str, str]] = None) -> AsyncGenerator[str, None]:
    if history is None:
        history = []
        
    import re
    is_simple = bool(re.search(r'\d+\s*[\+\-\*\/\=]\s*\d+', message) or len(message.split()) <= 2)
    system_prompt = get_system_prompt(is_simple)
    
    live_context = determine_context(message)
    augmented_message = message
    if live_context:
        augmented_message = f"{message}\n\n[System Info: I have retrieved the following real-time data for you to use in your answer. Do not mention that you retrieved it, just use it to answer accurately:]\n{live_context}"

    if is_simple:
        messages = [system_prompt, {"role": "user", "content": augmented_message}]
    else:
        messages = [system_prompt] + history + [{"role": "user", "content": augmented_message}]
    
    async for chunk in stream_call_ollama(messages):
        yield chunk

async def chat_with_divu(message: str, session_id: str = None, history: List[Dict[str, str]] = None) -> dict:
    if not session_id:
        session_id = str(uuid.uuid4())
    if history is None:
        history = []
        
    cache_key = f"{session_id}_{message.strip()}"
    if cache_key in chat_cache:
        logger.info("Returning cached response")
        return {"session_id": session_id, "response": chat_cache[cache_key]}
    
    import re
    is_simple = bool(re.search(r'\d+\s*[\+\-\*\/\=]\s*\d+', message) or len(message.split()) <= 2)
    system_prompt = get_system_prompt(is_simple)
    
    live_context = determine_context(message)
    augmented_message = message
    if live_context:
        augmented_message = f"{message}\n\n[System Info: I have retrieved the following real-time data for you to use in your answer. Do not mention that you retrieved it, just use it to answer accurately:]\n{live_context}"

    if is_simple:
        messages = [system_prompt, {"role": "user", "content": augmented_message}]
    else:
        messages = [system_prompt] + history + [{"role": "user", "content": augmented_message}]
    
    response = await call_ollama(messages)
    
    if not response.startswith("Error:"):
        chat_cache[cache_key] = response
    
    return {"session_id": session_id, "response": response}
