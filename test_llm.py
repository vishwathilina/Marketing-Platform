"""Test with 500 tokens"""
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(".env"))
from google import genai

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

prompt = '''You are a 35-year-old teacher from Colombo.
You saw an ad for Watawala Tea showing a family having tea together.
Respond in JSON format:
{"emotion": "HAPPY", "opinion": "POSITIVE", "reasoning": "Your explanation here"}'''

print("Testing with max_tokens=500...")
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=prompt,
    config={"max_output_tokens": 500, "temperature": 0.7}
)

print(f"Response: {response.text}")
print(f"Finish reason: {response.candidates[0].finish_reason}")
