import os
import redis
import sys
from dotenv import load_dotenv

# Load variables from frontend/.env for testing
load_dotenv(dotenv_path="frontend/.env")

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

print(f"Testing connection to Redis using URL:\n{REDIS_URL}\n")

try:
    # Initialize the client
    client = redis.Redis.from_url(REDIS_URL)
    
    # Ping the server
    if client.ping():
        print("✅ SUCCESS! Redis is running and successfully connected!")
        sys.exit(0)
    else:
        print("❌ FAILED! Redis did not respond to ping.")
        sys.exit(1)
        
except redis.exceptions.ConnectionError as e:
    print(f"❌ CONNECTION ERROR! Could not connect to Redis at that URL.")
    print(f"Details: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ UNEXPECTED ERROR: {e}")
    sys.exit(1)
