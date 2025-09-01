import requests
import random
import time

BASE_URL = "http://127.0.0.1:8000"

def safe_json(r):
    """Safely parse JSON responses, fallback to raw text if invalid."""
    try:
        return r.json()
    except Exception:
        return {"status_code": r.status_code, "text": r.text}

# -----------------------------
# Helper functions
# -----------------------------

def create_queue(name="Test Queue", description="Functional test queue"):
    url = f"{BASE_URL}/queue/create/"
    r = requests.post(url, json={"name": name, "description": description})
    data = safe_json(r)
    print("CREATE QUEUE:", data)
    return data.get("queue_id")

def delete_queue(queue_id):
    url = f"{BASE_URL}/queue/{queue_id}/delete/"
    r = requests.delete(url)
    print("DELETE QUEUE:", safe_json(r))

def flush_queue(queue_id):
    url = f"{BASE_URL}/queue/{queue_id}/flush/"
    r = requests.post(url)
    print("FLUSH QUEUE:", safe_json(r))

def join_queue(queue_id, msisdn, full_name=None):
    url = f"{BASE_URL}/queue/join/"
    payload = {"queue_id": queue_id, "msisdn": msisdn}
    if full_name:
        payload["full_name"] = full_name
    r = requests.post(url, json=payload)
    return safe_json(r)

def leave_queue(queue_id, msisdn):
    url = f"{BASE_URL}/queue/{queue_id}/leave/{msisdn}/"
    r = requests.post(url)
    return safe_json(r)

def get_position(queue_id, msisdn):
    url = f"{BASE_URL}/queue/{queue_id}/position/{msisdn}/"
    r = requests.get(url)
    return safe_json(r)

def get_status(queue_id, msisdn):
    url = f"{BASE_URL}/queue/{queue_id}/status/{msisdn}/"
    r = requests.get(url)
    return safe_json(r)

def update_status(queue_id, msisdn, status):
    url = f"{BASE_URL}/queue/{queue_id}/status/{msisdn}/update/"
    r = requests.put(url, json={"status": status})
    return safe_json(r)

def get_all_queues():
    url = f"{BASE_URL}/queues/all/"
    r = requests.get(url)
    return safe_json(r)

def generate_msisdn():
    return "27" + str(random.randint(600000000, 799999999))

# -----------------------------
# Test scenarios
# -----------------------------

def test_full_queue_flow(num_users=50):
    """Test creating a queue, joining users, status updates, leaving, flushing, and deletion."""
    print("\n=== STEP 1: Create Queue ===")
    queue_id = create_queue("Load Test Queue", "Testing full flow")
    if not queue_id:
        print("❌ Failed to create queue, aborting")
        return

    print("\n=== STEP 2: Add users to queue ===")
    users = [generate_msisdn() for _ in range(num_users)]
    for i, msisdn in enumerate(users, 1):
        join_queue(queue_id, msisdn, f"User {i}")
        if i % 10 == 0:
            print(f"Joined {i}/{num_users}")

    print("\n=== STEP 3: Check positions ===")
    errors = 0
    for i, msisdn in enumerate(users, 1):
        pos = get_position(queue_id, msisdn)
        if pos.get("position") != i:
            print(f"❌ Position error: {msisdn} expected {i}, got {pos}")
            errors += 1
    print(f"✅ Position check complete, {errors} errors")

    print("\n=== STEP 4: Update status ===")
    for msisdn in users[:5]:
        update_status(queue_id, msisdn, "in_progress")
    for msisdn in users[:2]:
        update_status(queue_id, msisdn, "served")

    print("\n=== STEP 5: Check status ===")
    for msisdn in users[:5]:
        status = get_status(queue_id, msisdn)
        print(status)

    print("\n=== STEP 6: Leave queue ===")
    for msisdn in users[5:10]:
        leave_queue(queue_id, msisdn)

    print("\n=== STEP 7: Flush queue ===")
    flush_queue(queue_id)
    # Confirm queue is empty
    all_queues = get_all_queues()
    for q in all_queues.get("queues", []):
        if q["queue_id"] == queue_id:
            entry_count = len(q["entries"])
            print(f"Entries after flush: {entry_count}")

    print("\n=== STEP 8: Delete queue ===")
    delete_queue(queue_id)

# -----------------------------
# Run test
# -----------------------------

if __name__ == "__main__":
    test_full_queue_flow(num_users=50)
