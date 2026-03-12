from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import redis
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "http://localhost:8000")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "dummy_key")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
redis_client = redis.Redis.from_url(REDIS_URL)

@app.get("/")
def read_root():
    return {"message": "Content Engine API is running."}

@app.get("/api/content/briefs")
def get_briefs():
    response = supabase.table("content_briefs").select("id, title, target_keyword, status, created_at").order('created_at', desc=True).execute()
    return response.data

@app.get("/api/content/posts")
def get_posts():
    response = supabase.table("content").select("id, title, seo_score, live_url, status, created_at").order('created_at', desc=True).execute()
    return response.data

@app.get("/api/content/performance")
def get_performance():
    response = supabase.table("post_performance").select("*").order('created_at', desc=True).limit(50).execute()
    return response.data
    
# Advanced endpoint for triggering agent 01
@app.post("/api/content/scan-trends")
def trigger_agent_01():
    # Publish an event to tell Agent 01 to scan trends right now
    # Since agent 01 runs on cron, we can also add an immediate trigger
    pass
