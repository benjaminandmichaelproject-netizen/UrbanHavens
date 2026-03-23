from django.urls import path
from .views import AssistantChatView, ChatHistoryView

urlpatterns = [
    path("chat/",    AssistantChatView.as_view(), name="assistant-chat"),
    path("history/", ChatHistoryView.as_view(),   name="assistant-history"),
]