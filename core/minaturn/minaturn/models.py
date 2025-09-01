from django.db import models
from django.contrib.auth.models import User
from shortuuid.django_fields import ShortUUIDField
from django.utils import timezone

class Queue(models.Model):
    id = ShortUUIDField(primary_key=True, length=6, alphabet="LGXHFKPDS1234567890")
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='queues', null=True, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class QueueEntry(models.Model):
    class Status(models.TextChoices):
        WAITING = "waiting", "Waiting"
        IN_PROGRESS = "in_progress", "In Progress"
        SERVED = "served", "Served"

    id = ShortUUIDField(primary_key=True, length=8, alphabet="ADFPHSMR1234567890")
    msisdn = models.CharField(max_length=15)  # phone number
    full_name = models.CharField(max_length=255, blank=True, null=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    left = models.BooleanField(default=False)  # whether the user has left the queue
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.WAITING,
    )
    queue = models.ForeignKey('Queue', on_delete=models.CASCADE, related_name='items')

    # Timestamps for status changes
    started_at = models.DateTimeField(blank=True, null=True)  # when status -> IN_PROGRESS
    served_at = models.DateTimeField(blank=True, null=True)   # when status -> SERVED

    def save(self, *args, **kwargs):
        # Trigger timestamps based on status change
        if self.status == self.Status.IN_PROGRESS and not self.started_at:
            self.started_at = timezone.now()
        if self.status == self.Status.SERVED and not self.served_at:
            self.served_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.msisdn} in {self.queue.name}"