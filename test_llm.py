"""Test Qwen LLM via HuggingFace Space (Ollama API)"""
import os
import json
import time
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(".env"))

API_URL = os.getenv("QWEN_API_URL", "https://vish85521-doc.hf.space/api/generate")
MODEL_NAME = os.getenv("QWEN_MODEL_NAME", "qwen3.5:397b-cloud")

prompt = '''You are a 35-year-old teacher from Colombo.
You saw an ad for Watawala Tea showing a family having tea together.
Respond in JSON format:
{"emotion": "HAPPY", "opinion": "POSITIVE", "reasoning": "Your explanation here"}'''

print(f"Testing Qwen model: {MODEL_NAME}")
print(f"API URL: {API_URL}")
print(f"Prompt: {prompt[:80]}...")
print("Sending request (this may take 30-60s on free CPU)...\n")

start_time = time.time()
try:
    response = requests.post(
        API_URL,
        json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": True,
            "format": "json"
        },
        stream=True,
        timeout=180,
    )

    print(f"--- HTTP Response Details ---")
    print(f"Status Code: {response.status_code}")
    print(f"Headers: {json.dumps(dict(response.headers), indent=2)}")
    print(f"Elapsed Time so far: {time.time() - start_time:.2f}s\n")

    if response.status_code != 200:
        print(f"ERROR: HTTP {response.status_code}")
        print(f"Raw response text: {response.text[:500]}")
        exit(1)

    # Parse streaming NDJSON
    full_response = ""
    full_thinking = ""
    print("--- Streaming Output ---")
    for line in response.iter_lines():
        if not line:
            continue
            
        if isinstance(line, bytes):
            line_str = line.decode('utf-8', errors='replace').strip()
        else:
            line_str = line.strip()
            
        if not line_str:
            continue
            
        # print(f"[RAW] {line_str}") # Commenting out raw line to keep it clean
        try:
            data = json.loads(line_str)
            if data.get("response"):
                full_response += data["response"]
                print(data["response"], end="", flush=True)
            if data.get("thinking"):
                full_thinking += data["thinking"]
        except json.JSONDecodeError as e:
            print(f"[JSON DECODE ERROR] {e} on line: {line_str}")
            continue

    print(f"\n--- Final Overview ---")
    print(f"Total Elapsed Time: {time.time() - start_time:.2f}s")
    print(f"Thinking content ({len(full_thinking)} chars): {full_thinking}")
    print(f"Response content ({len(full_response)} chars): {full_response}")

except Exception as e:
    print(f"\n[EXCEPTION CAUGHT] {type(e).__name__}: {str(e)}")
