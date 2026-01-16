from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import time 
from ollama import chat
from ollama import ChatResponse
from ollama import Client
import os 

from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

client = Client(
    host="https://ollama.com",
    headers={'Authorization': 'Bearer ' + os.environ.get('OLLAMA_API_KEY')},)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # during development; narrow this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the request body schema
class UserInput(BaseModel):
    text: str


messages = [{'role':'system','content':'you are a helpful text message assistant that provides short accuracy-focused answers.'}]
MAX_MESSAGES = 40  # total role entries (not tokens)

def chat_with_memory(user_input):
    messages.append({'role': 'user', 'content': user_input})

    # trim oldest user/assistant pairs while keeping the system prompt
    while len(messages) > MAX_MESSAGES:
        # remove the earliest non-system message
        for i in range(1, len(messages)):
            if messages[i]['role'] in ('user','assistant'):
                messages.pop(i)
                break

    response = client.chat(model='gemma3:4b-cloud',
                                        messages=messages, 
                                        options = {'temperature': 0.1,     # Lower for more factual, deterministic answers
                                                    'top_p': 0.6,           # Limits word choice to the most likely options
                                                    'num_predict': 50,      # Strict token limit to prevent rambling
                                                    'top_k': 10,            # Further narrows choices to top results
                                                    'repeat_last_n': 84     # Increased to better detect and prevent repetition
                                                }, 
                                        stream=False)

    # response.message may have structure; append assistant content explicitly
    assistant_text = getattr(response, 'message', {}).get('content') if hasattr(response, 'message') else response.content
    messages.append({'role': 'assistant', 'content': assistant_text})
    return assistant_text


@app.post("/echo")
def echo_input(data: UserInput):
    """
    Receives JSON from Node.js and echoes it back

    """
    
    response_text = chat_with_memory(data.text)

    return {
        "original": data.text,
        "echo": response_text
    }
