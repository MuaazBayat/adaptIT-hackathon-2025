"""
URL configuration for minaturn project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from . import views


urlpatterns = [
    path('admin/', admin.site.urls),
    # Authentication endpoints
    path("auth/login/", views.login, name="login"),
    path("auth/register/", views.register, name="register"),
    # Queue endpoints
    path("queue/create/", views.create_queue, name="create_queue"),
    path("queue/<str:queue_id>/flush/", views.flush_queue, name="flush_queue"),
    path("queue/<str:queue_id>/delete/", views.delete_queue, name="delete_queue"),
    path("queue/join/", views.join_queue, name="join-queue"),
    path("queue/<str:queue_id>/leave/<str:msisdn>/", views.leave_queue, name="leave_queue"),
    path("queue/<str:queue_id>/status/<str:msisdn>/", views.get_status, name="get_status"),
    path("queue/<str:queue_id>/status/<str:msisdn>/update/", views.update_status, name="update_status"),
    path("queue/<str:queue_id>/position/<str:msisdn>/", views.queue_position, name="queue-position"),
    path("queues/all/", views.all_queues_with_entries, name="all_queues_with_entries"),
    # Alert endpoint
    path("alert/", views.alert, name="alert"),
]