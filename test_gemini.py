"""Test Gemini API to find available models with vision support"""
import os
from dotenv import load_dotenv
load_dotenv()

from google import genai

api_key = os.getenv("GEMINI_API_KEY")
print(f"API Key present: {bool(api_key)}")

client = genai.Client(api_key=api_key)

# List available models
print("\nAvailable models:")
print("=" * 60)

for model in client.models.list():
    print(f"- {model.name}")
    
print("\n" + "=" * 60)
print("Testing text generation with different models...")

# Try different model names
model_names = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-pro",
    "gemini-3-flash-preview"
]

for model_name in model_names:
    try:
        response = client.models.generate_content(
            model=model_name,
            contents="Say hello"
        )
        print(f"✓ {model_name}: Works!")
    except Exception as e:
        print(f"✗ {model_name}: {str(e)[:50]}")
