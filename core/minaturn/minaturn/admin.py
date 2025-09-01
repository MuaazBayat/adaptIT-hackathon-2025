from django.contrib import admin
from .models import Queue, QueueEntry


@admin.register(Queue)
class QueueAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "description", "created_at")
    search_fields = ("name",)
    ordering = ("created_at",)


@admin.register(QueueEntry)
class QueueEntryAdmin(admin.ModelAdmin):
    list_display = (
        "msisdn",
        "full_name",
        "queue",
        "status",
        "joined_at",
        "started_at",
        "served_at",
        "left",
    )
    list_filter = ("queue", "status", "left")
    search_fields = ("msisdn", "full_name")
    readonly_fields = ("joined_at", "started_at", "served_at")  # auto timestamps