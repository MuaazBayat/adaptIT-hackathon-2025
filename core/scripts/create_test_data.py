import requests
import random
import time
from datetime import datetime, timedelta
import json

BASE_URL = "http://127.0.0.1:8000"

def safe_json(r):
    """Safely parse JSON responses, fallback to raw text if invalid."""
    try:
        return r.json()
    except Exception:
        return {"status_code": r.status_code, "text": r.text}

def create_queue(name="Test Clinic Queue", description="Sample data for scheduler testing"):
    url = f"{BASE_URL}/queue/create/"
    r = requests.post(url, json={"name": name, "description": description})
    data = safe_json(r)
    print("CREATE QUEUE:", data)
    return data.get("queue_id")

def join_queue(queue_id, msisdn, full_name=None):
    url = f"{BASE_URL}/queue/join/"
    payload = {"queue_id": queue_id, "msisdn": msisdn}
    if full_name:
        payload["full_name"] = full_name
    r = requests.post(url, json=payload)
    return safe_json(r)

def update_status(queue_id, msisdn, status):
    url = f"{BASE_URL}/queue/{queue_id}/status/{msisdn}/update/"
    r = requests.put(url, json={"status": status})
    return safe_json(r)

def generate_msisdn():
    return "27" + str(random.randint(600000000, 799999999))

def create_realistic_test_data():
    """Create realistic queue data with proper timing patterns"""
    
    print("\n=== Creating Realistic Test Data ===")
    
    # Create queue
    queue_id = create_queue("Main Service Counter", "Realistic test data with timing")
    if not queue_id:
        print("❌ Failed to create queue")
        return None
    
    print(f"✅ Created queue: {queue_id}")
    
    # Generate customers with realistic patterns
    customers = []
    
    # 1. Recently completed customers (for avg calculation)
    print("\n📊 Adding recently completed customers...")
    for i in range(5):
        msisdn = generate_msisdn()
        name = f"Completed Customer {i+1}"
        customers.append({"msisdn": msisdn, "name": name, "type": "completed"})
        
        # Join queue
        join_result = join_queue(queue_id, msisdn, name)
        print(f"  Joined: {name} ({msisdn})")
        
        # Simulate realistic timing: 
        # Wait a bit, then mark as in_progress, then served
        time.sleep(0.1)  # Small delay
        
        # Update to in_progress
        update_status(queue_id, msisdn, "in_progress")
        print(f"  → In progress: {name}")
        
        # Simulate service time (2-8 minutes)
        service_time = random.randint(2, 8)
        time.sleep(0.1)  # Small delay to simulate service time
        
        # Update to served
        update_status(queue_id, msisdn, "served")
        print(f"  ✅ Served: {name} (simulated {service_time}min service)")
    
    # 2. Currently in progress customer
    print("\n🔄 Adding customer currently being served...")
    msisdn = generate_msisdn()
    name = "Current Customer"
    customers.append({"msisdn": msisdn, "name": name, "type": "current"})
    
    join_queue(queue_id, msisdn, name)
    update_status(queue_id, msisdn, "in_progress")
    print(f"  🔄 Currently being served: {name}")
    
    # 3. Waiting customers (should trigger alerts)
    print("\n⏰ Adding waiting customers...")
    for i in range(8):
        msisdn = generate_msisdn()
        name = f"Waiting Customer {i+1}"
        customers.append({"msisdn": msisdn, "name": name, "type": "waiting"})
        
        join_queue(queue_id, msisdn, name)
        print(f"  ⏳ Waiting: {name} (Position {i+2})")  # Position 2-9
        
        time.sleep(0.1)  # Small delay between joins
    
    print(f"\n✅ Created realistic test data:")
    print(f"  - Queue ID: {queue_id}")
    print(f"  - 5 completed customers (for avg calculation)")
    print(f"  - 1 customer currently being served")
    print(f"  - 8 customers waiting (positions 2-9)")
    print(f"  - Total: {len(customers)} customers")
    
    return queue_id, customers

def show_queue_status(queue_id):
    """Display current queue status"""
    url = f"{BASE_URL}/queues/all/"
    r = requests.get(url)
    data = safe_json(r)
    
    print(f"\n=== Queue Status ===")
    
    for queue in data.get("queues", []):
        if queue["queue_id"] == queue_id:
            print(f"Queue: {queue['name']} ({queue_id})")
            print(f"Entries: {len(queue['entries'])}")
            
            waiting = [e for e in queue['entries'] if e['status'] == 'waiting' and not e['left']]
            in_progress = [e for e in queue['entries'] if e['status'] == 'in_progress']
            served = [e for e in queue['entries'] if e['status'] == 'served']
            
            print(f"  - Waiting: {len(waiting)}")
            print(f"  - In Progress: {len(in_progress)}")
            print(f"  - Served: {len(served)}")
            
            print("\nNext few customers:")
            for i, entry in enumerate(waiting[:3]):
                print(f"  {i+1}. {entry.get('full_name', 'Unknown')} ({entry['msisdn']})")
            
            return True
    
    print("❌ Queue not found")
    return False

if __name__ == "__main__":
    print("🧪 Creating Test Data for Queue Scheduler")
    print("Make sure Django server is running on http://127.0.0.1:8000")
    
    # Test API connectivity
    try:
        r = requests.get(f"{BASE_URL}/queues/all/")
        print("✅ Django API is accessible")
    except Exception as e:
        print(f"❌ Cannot connect to Django API: {e}")
        exit(1)
    
    # Create test data
    result = create_realistic_test_data()
    if result:
        queue_id, customers = result
        
        # Show final status
        show_queue_status(queue_id)
        
        print(f"\n🚀 Ready for scheduler testing!")
        print(f"Run: ./queue-scheduler")
        print(f"The scheduler should calculate avg processing time and send alerts for customers in positions 1-2")
        
    else:
        print("❌ Failed to create test data")