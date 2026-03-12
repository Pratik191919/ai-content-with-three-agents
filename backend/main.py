from fastapi import FastAPI
import uvicorn

# Importing the agent functions
from agent_01_content_strategist import run_agent_01
# agent_02 uses listen_for_events or process_brief normally
from agent_02_blog_writer import process_brief

app = FastAPI()

@app.get("/")
def home():
    return {"status": "running"}

@app.post("/run-agents")
def run_agents():
    # Run Agent 1 (This scans trends, creates briefs, and publishes to Redis)
    run_agent_01()
    
    # Note: Agent 2 and Agent 3 are designed to listen to Redis events automatically.
    # If they are running in the background, Agent 1's execution is enough to trigger them.
    # If you want to bypass Redis and trigger them sequentially, you would need to modify
    # run_agent_01 to return the brief_id and pass it directly to process_brief(brief_id).
    
    return {"message": "agents executed"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
