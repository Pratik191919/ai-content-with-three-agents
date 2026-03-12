import os
import redis
import json
from supabase import create_client, Client
import google.generativeai as genai

# Environment variables
SUPABASE_URL = os.environ.get("SUPABASE_URL", "http://localhost:8000")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "dummy_key")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Initialize clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
redis_client = redis.Redis.from_url(REDIS_URL)

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
# llm_model = genai.GenerativeModel('gemini-2.5-flash')

def fetch_gsc_data(url):
    """
    Mock Google Search Console data fetching.
    """
    print(f"Agent 03: Fetching GSC data for {url}...")
    # Return simulated CTR, position, clicks, etc.
    return {
        "avg_position": 15.2,
        "clicks": 142,
        "ctr": 1.2,
        "impressions": 11800,
        "content_freshness": "low",
        "word_count_diff": -300
    }

def calculate_performance_score(gsc_data, seo_score):
    """
    Calculate an overall performance score based on multiple factors.
    """
    print("Agent 03: Calculating performance score...")
    # Base logic mapping real metrics to a 0-100 score. 
    # Example logic:
    score = 100
    if gsc_data["ctr"] < 3.0:
        score -= 15
    if gsc_data["avg_position"] > 10:
        score -= 20
    if gsc_data["content_freshness"] == "low":
        score -= 15
    if gsc_data["word_count_diff"] < 0:
        score -= 10
        
    final_score = (score + seo_score) / 2
    return int(final_score)

def create_rewrite_brief(post_id, post_data, metrics, score):
    """
    Use LLM to generate a rewriting guide/brief.
    """
    print(f"Agent 03: Performance score {score} < 60. Creating rewrite brief for {post_id}...")
    
    # Store performance metrics
    supabase.table("post_performance").insert({
        "post_id": post_id,
        "avg_position": metrics["avg_position"],
        "clicks": metrics["clicks"],
        "ctr": metrics["ctr"],
        "impressions": metrics["impressions"],
        "score": score
    }).execute()
    
    # In a real app, you would create a new entry in a rewrite_briefs table or update content_briefs
    print(f"Agent 03: Sending rewrite task back to Agent 02...")
    
    event_data = {
        "event": "audit_complete",
        "post_id": post_id,
        "action": "rewrite",
        "reason": f"Low CTR ({metrics['ctr']}%) and poor rank."
    }
    redis_client.publish("content_events", json.dumps(event_data))

def process_audit(post_id):
    # Fetch post
    response = supabase.table("content").select("*").eq("id", post_id).execute()
    if not response.data:
        print(f"Agent 03: Post {post_id} not found!")
        return
        
    post = response.data[0]
    live_url = post['live_url']
    seo_score = post['seo_score']
    
    metrics = fetch_gsc_data(live_url)
    score = calculate_performance_score(metrics, seo_score)
    
    print(f"Agent 03: Calculated score {score} for post {post['title']}")
    
    if score < 60:
        create_rewrite_brief(post_id, post, metrics, score)
    else:
        print("Agent 03: Score is 60 or higher. No action needed.")

def listen_for_events():
    """
    Listen on Redis queue.
    """
    print("Agent 03 - Content Auditor listening for events...")
    pubsub = redis_client.pubsub()
    pubsub.subscribe("content_events")
    
    for message in pubsub.listen():
        if message['type'] == 'message':
            data = json.loads(message['data'])
            if data['event'] == 'post_published':
                post_id = data['post_id']
                process_audit(post_id)

if __name__ == "__main__":
    listen_for_events()
