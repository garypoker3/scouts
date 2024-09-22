from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("init", views.init, name="init"),
    path("save-position", views.save_position, name="save-position"),
    path("set-destination", views.set_destination, name="set-destination"),
    path("confirm-destination", views.confirm_destination, name="confirm-destination"),
    path("save-message", views.save_message, name="save-message"),
    path("mark-message-read", views.mark_message_read, name="mark-message-read"),
    
    path("position-stream/", views.sse_position_stream, name="sse_position_stream"),
    path("marker-stream/", views.sse_marker_stream, name="sse_marker_stream"),
    path("message-stream/", views.sse_message_stream, name="sse_message_stream"),
    path("confirm-msg-stream/", views.sse_confirm_msg_stream, name="sse_confirm_msg_stream"),
    
    path("login", views.login_view, name="login"),
    path("logout", views.logout_view, name="logout"),
    path("register", views.register, name="register"),
]
