import json
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.conf import settings
from .models import Queue, QueueEntry

def get_user_from_credentials(username, password):
    """Helper function to get user from username/password"""
    user = authenticate(username=username, password=password)
    return user

@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    try:
        data = json.loads(request.body)
        username = data.get("username")
        password = data.get("password")
        
        if not username or not password:
            return JsonResponse({"error": "Username and password required"}, status=400)
            
        user = authenticate(username=username, password=password)
        if user:
            return JsonResponse({
                "success": True,
                "user_id": user.id,
                "username": user.username
            })
        else:
            return JsonResponse({"error": "Invalid credentials"}, status=401)
            
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    try:
        data = json.loads(request.body)
        username = data.get("username")
        password = data.get("password")
        
        if not username or not password:
            return JsonResponse({"error": "Username and password required"}, status=400)
            
        if User.objects.filter(username=username).exists():
            return JsonResponse({"error": "Username already exists"}, status=400)
            
        user = User.objects.create_user(username=username, password=password)
        return JsonResponse({
            "success": True,
            "user_id": user.id,
            "username": user.username
        }, status=201)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

@csrf_exempt
def join_queue(request):
    if request.method == "POST":
        try:
            
            data = json.loads(request.body.decode("utf-8"))
            queue = get_object_or_404(Queue, id=data["queue_id"])
            print(f"Attempting to join queue with body: {request.body}")
            
            position = QueueEntry.objects.filter(queue=queue, left=False).count() + 1
            time_to_front = calculate_average_processing_time(queue.id)
            queue_name = queue.name
                # Create new QueueEntry
            entry = QueueEntry.objects.create(
                msisdn=data["msisdn"],
                queue=queue,
                left=False
            )
            return JsonResponse({"id": str(entry.id), "queue_name": queue_name,"status": "joined", "position": position, "average_time_to_process": time_to_front})
        except (KeyError, json.JSONDecodeError):
            return JsonResponse({"error": "Invalid request data"}, status=400)

    return JsonResponse({"error": "POST only"}, status=400)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_queue(request, queue_id):
    try:
        queue = Queue.objects.get(id=queue_id)
    except Queue.DoesNotExist:
        return JsonResponse({"error": "Queue not found"}, status=404)

    # Optionally, also delete all queue entries
    QueueEntry.objects.filter(queue_id=queue_id).delete()
    queue.delete()

    return JsonResponse({"success": True, "queue_id": str(queue_id)})

@csrf_exempt
@require_http_methods(["POST"])
def flush_queue(request, queue_id):
    try:
        queue = Queue.objects.get(id=queue_id)
    except Queue.DoesNotExist:
        return JsonResponse({"error": "Queue not found"}, status=404)

    deleted_count, _ = QueueEntry.objects.filter(queue_id=queue_id).delete()

    return JsonResponse({
        "success": True,
        "queue_id": str(queue.id),
        "flushed_entries": deleted_count
    })


@csrf_exempt
@require_http_methods(["POST"])
def leave_queue(request, queue_id, msisdn):
    try:
        entry = QueueEntry.objects.get(queue_id=queue_id, msisdn=msisdn, left=False)
        entry.left = True
        entry.save()
        return JsonResponse({"success": True, "msisdn": msisdn, "queue_id": queue_id})
    except QueueEntry.DoesNotExist:
        return JsonResponse({"error": "Entry not found or already left"}, status=404)


@require_http_methods(["GET"])
def get_status(request, queue_id, msisdn):
    try:
        entry = QueueEntry.objects.filter(queue=queue_id, left=False).get(queue_id=queue_id, msisdn=msisdn)
        queue = get_object_or_404(Queue, id=queue_id)
        position = calculate_queue_position(queue_id, msisdn)
        time_to_front = calculate_average_processing_time(queue.id)
        return JsonResponse({
            "msisdn": entry.msisdn,
            "queue_name": entry.queue.name,
            "position": position,
            "average_time_to_process": time_to_front,
            "queue_id": queue_id,
            "status": entry.status,
            "left": entry.left,
            "joined_at": entry.joined_at.isoformat(),
            "started_at": entry.started_at.isoformat() if entry.started_at else None,
            "served_at": entry.served_at.isoformat() if entry.served_at else None
        })
    except QueueEntry.DoesNotExist:
        return JsonResponse({"error": "Entry not found"}, status=404)


@csrf_exempt
@require_http_methods(["PUT"])
def update_status(request, queue_id, msisdn):
    try:
        entry = QueueEntry.objects.get(queue_id=queue_id, msisdn=msisdn)
        data = json.loads(request.body)
        status = data.get("status")
        if status not in [choice[0] for choice in QueueEntry.Status.choices]:
            return JsonResponse({"error": "Invalid status"}, status=400)
        entry.status = status
        entry.save()
        return JsonResponse({
            "success": True,
            "msisdn": entry.msisdn,
            "queue_id": queue_id,
            "status": entry.status
        })
    except QueueEntry.DoesNotExist:
        return JsonResponse({"error": "Entry not found"}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

def queue_position(request, queue_id, msisdn):
    try:
        entry = QueueEntry.objects.get(queue_id=queue_id, msisdn=msisdn, left=False)
    except QueueEntry.DoesNotExist:
        return JsonResponse({"error": "Not in queue"}, status=404)

    # Position = count of people who joined earlier and haven’t left
    position = (
        QueueEntry.objects.filter(queue_id=queue_id, left=False, joined_at__lt=entry.joined_at)
        .count()
        + 1
    )

    return JsonResponse({
        "msisdn": msisdn,
        "queue_id": str(queue_id),
        "position": position
    })

@csrf_exempt
def create_queue(request):
    try:
        data = json.loads(request.body)
        name = data.get("name")
        description = data.get("description", "")
        username = data.get("username")
        password = data.get("password")

        if not name:
            return JsonResponse({"error": "name is required"}, status=400)
        
        if not username or not password:
            return JsonResponse({"error": "Username and password required"}, status=401)

        user = get_user_from_credentials(username, password)
        if not user:
            return JsonResponse({"error": "Invalid credentials"}, status=401)

        # Create Queue owned by user
        queue = Queue.objects.create(name=name, description=description, owner=user)

        return JsonResponse({
            "success": True,
            "queue_id": str(queue.id),
            "name": queue.name,
            "description": queue.description,
            "created_at": queue.created_at.isoformat()
        }, status=201)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def all_queues_with_entries(request):
    # Get auth from query params for GET request
    username = request.GET.get('username')
    password = request.GET.get('password')
    
    if not username or not password:
        return JsonResponse({"error": "Username and password required"}, status=401)
    
    user = get_user_from_credentials(username, password)
    if not user:
        return JsonResponse({"error": "Invalid credentials"}, status=401)
    
    # Only return queues owned by this user (exclude null owners)
    queues = Queue.objects.filter(owner=user)
    result = []

    for queue in queues:
        entries = queue.items.all().order_by("joined_at")  # related_name='items'
        result.append({
            "queue_id": str(queue.id),
            "name": queue.name,
            "description": queue.description,
            "created_at": queue.created_at.isoformat(),
            "entries": [
                {
                    "msisdn": entry.msisdn,
                    "full_name": entry.full_name,
                    "joined_at": entry.joined_at.isoformat(),
                    "left": entry.left,
                    "status": entry.status,
                    "started_at": entry.started_at.isoformat() if entry.started_at else None,
                    "served_at": entry.served_at.isoformat() if entry.served_at else None
                } for entry in entries
            ]
        })

    return JsonResponse({"queues": result})


def calculate_average_processing_time(queue_id):
    """
    Calculate average time to process for a given queue.
    
    Example:
     - A user joins the queue at 10:00 AM
     - The user is processed at 10:30 AM (started_at)
     - The user gets served at 10:45 AM (served_at)
    Time to process for this user = 15 minutes
    
    Calculates average for all users processed in the last 30 minutes.
    """
    from django.utils import timezone
    from datetime import timedelta

    try:
        queue = Queue.objects.get(id=queue_id)
    except Queue.DoesNotExist:
        return -1

    thirty_minutes_ago = timezone.now() - timedelta(minutes=30)
    entries = QueueEntry.objects.filter(
        queue=queue,
        served_at__isnull=False,
        started_at__isnull=False,
        served_at__gte=thirty_minutes_ago
    )

    if not entries.exists():
        return -1

    total_time = sum((entry.served_at - entry.started_at).total_seconds() for entry in entries)
    average_time_seconds = total_time / entries.count()

    return average_time_seconds

def calculate_queue_position(queue_id, msisdn):
    """
    Calculate position in queue for a specific entry.
    Returns position number (1-indexed) or -1 if not found.
    """
    try:
        entry = QueueEntry.objects.get(queue_id=queue_id, msisdn=msisdn, left=False)
    except QueueEntry.DoesNotExist:
        return -1

    position = (
        QueueEntry.objects.filter(queue_id=queue_id, left=False, joined_at__lt=entry.joined_at)
        .count()
        + 1
    )
    return position

def send_whatsapp_message(msisdn, message):
    """
    Send WhatsApp message directly via WhatsApp Business API.
    Uses the same method as the Go code.
    """
    whatsapp_url = settings.WHATSAPP_API_URL
    access_token = settings.WHATSAPP_ACCESS_TOKEN
    
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": msisdn,
        "type": "text",
        "text": {
            "preview_url": True,
            "body": message
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}"
    }
    
    try:
        response = requests.post(whatsapp_url, json=payload, headers=headers, timeout=30)
        if response.status_code >= 200 and response.status_code < 300:
            print(f"✅ WhatsApp message sent successfully to {msisdn}")
            return True
        else:
            print(f"❌ WhatsApp API error (status {response.status_code}): {response.text}")
            return False
    except requests.RequestException as e:
        print(f"Error sending WhatsApp message to {msisdn}: {e}")
        return False

@csrf_exempt
@require_http_methods(["POST"])
def alert(request):
    """
    Alert endpoint that:
    1. Fetches non-empty queues
    2. For each queue: fetch entries, calculate time and positions
    3. For each entry in queue: send WhatsApp message
    """
    try:
        data = json.loads(request.body)
        username = data.get("username")
        password = data.get("password")
        
        if not username or not password:
            return JsonResponse({"error": "Username and password required"}, status=401)
        
        user = get_user_from_credentials(username, password)
        if not user:
            return JsonResponse({"error": "Invalid credentials"}, status=401)
        
        # Fetch all non-empty queues owned by the user
        queues = Queue.objects.filter(owner=user).prefetch_related('items')
        non_empty_queues = [q for q in queues if q.items.filter(left=False).exists()]
        
        results = []
        
        for queue in non_empty_queues:
            # Fetch entries in queue (not left)
            entries = queue.items.filter(left=False).order_by('joined_at')
            
            # Calculate time and positions for queue
            avg_processing_time = calculate_average_processing_time(queue.id)
            
            queue_results = {
                'queue_id': str(queue.id),
                'queue_name': queue.name,
                'total_entries': entries.count(),
                'avg_processing_time': avg_processing_time,
                'messages_sent': []
            }
            
            # Send WhatsApp message to each entry
            for entry in entries:
                position = calculate_queue_position(queue.id, entry.msisdn)
                
                # Estimate wait time based on position and avg processing time
                if avg_processing_time > 0 and position > 0:
                    estimated_wait_minutes = (position - 1) * (avg_processing_time / 60)
                    
                    if estimated_wait_minutes <= 30:
                        message = f"🚨 {queue.name} - Ready Soon!\n" \
                                 f"👤 Your position: {position}\n" \
                                 f"⏱️ Estimated wait: {int(estimated_wait_minutes)} minutes\n" \
                                 f"🏃‍♂️ Please come through now - your turn is coming up!"
                    else:
                        message = f"📍 Queue Update: {queue.name}\n" \
                                 f"👤 Your position: {position}\n" \
                                 f"⏱️ Estimated wait: {int(estimated_wait_minutes)} minutes\n" \
                                 f"📱 We'll notify you when it's your turn!"
                else:
                    message = f"📍 Queue Update: {queue.name}\n" \
                             f"👤 Your position: {position}\n" \
                             f" The queue has not started moving yet, so unfortunately we cant tell you how long it will be till your turn. Please use your discretion. \n" \
                
                # Send WhatsApp message
                success = send_whatsapp_message(entry.msisdn, message)
                
                queue_results['messages_sent'].append({
                    'msisdn': entry.msisdn,
                    'position': position,
                    'estimated_wait': message,
                    'message_sent': success
                })
            
            results.append(queue_results)
        
        return JsonResponse({
            'success': True,
            'queues_processed': len(non_empty_queues),
            'results': results
        })
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)