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

def generate_blog_post(brief):
    """
    Simulate generating a 1500-2500 word blog post using Claude/GPT.
    Includes SEO formatting, internal linking, FAQ schema.
    """
    print(f"Agent 02: Generating content for brief: {brief['title']}...")
    html_content = f"<h1>{brief['title']}</h1>\n<p>This is a complete 2000-word post with optimized H2s and FAQs.</p>"
    seo_score = 92
    return html_content, seo_score

def generate_featured_image(title):
    """
    Simulate generating an image using DALL-E.
    """
    print(f"Agent 02: Generating DALL-E featured image for '{title}'...")
    return "https://via.placeholder.com/800x400"

def publish_to_cms(post_data):
    """
    Simulate publishing to WordPress/Webflow.
    """
    print(f"Agent 02: Publishing '{post_data['title']}' to CMS...")
    # Return simulated live URL
    formatted_title = post_data['title'].replace(" ", "-").lower()
    return f"https://myblog.com/posts/{formatted_title}"

def process_brief(brief_id):
    # Fetch brief
    response = supabase.table("content_briefs").select("*").eq("id", brief_id).execute()
    if not response.data:
        print(f"Agent 02: Brief {brief_id} not found!")
        return
        
    brief = response.data[0]
    
    # Update status
    supabase.table("content_briefs").update({"status": "IN_PROGRESS"}).eq("id", brief_id).execute()
    
    # Generate content
    html_content, seo_score = generate_blog_post(brief)
    
    # Generate Image
    image_url = generate_featured_image(brief['title'])
    
    # Create CMS entry (Simulated)
    live_url = publish_to_cms({"title": brief['title']})
    
    # Save to Supabase DB 'content' table
    post_response = supabase.table("content").insert({
        "brief_id": brief_id,
        "title": brief['title'],
        "html_content": html_content,
        "seo_score": seo_score,
        "live_url": live_url,
        "featured_image_url": image_url,
        "status": "PUBLISHED"
    }).execute()
    
    # Update brief status
    supabase.table("content_briefs").update({"status": "PUBLISHED"}).eq("id", brief_id).execute()
    
    # Emit event
    post_id = post_response.data[0]['id']
    event_data = {
        "event": "post_published",
        "post_id": post_id,
        "live_url": live_url
    }
    redis_client.publish("content_events", json.dumps(event_data))
    print(f"Agent 02: Blog post {post_id} published & event emitted!")

def listen_for_events():
    """
    Listen on Redis queue.
    """
    print("Agent 02 - Blog Writer listening for events...")
    pubsub = redis_client.pubsub()
    pubsub.subscribe("content_events")
    
    for message in pubsub.listen():
        if message['type'] == 'message':
            data = json.loads(message['data'])
            if data['event'] == 'content_briefs_ready':
                brief_id = data['brief_id']
                process_brief(brief_id)

if __name__ == "__main__":
    listen_for_events()
