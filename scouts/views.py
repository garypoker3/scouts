from django.contrib.auth import authenticate, login, logout
from django.db import IntegrityError
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.contrib.auth import aget_user
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt

from django.utils import timezone
import json

from django.db.models import Q, Case, When, Value, CharField
from django.db.models.functions import Concat

from .models import Scout, Unit, Position, Destination, Alert, Marker, Message
from django.http import StreamingHttpResponse
from django.core.serializers.json import DjangoJSONEncoder

import asyncio

def create_sse_close_response(message="Connection closed by server"):
    """
    Creates a StreamingHttpResponse that closes an SSE connection.
    
    :param message: Optional custom message to send with the close event.
    :return: StreamingHttpResponse configured to close the SSE connection.
    """
    close_message = f"event: close\ndata: {message}\n\n"
    response = StreamingHttpResponse(close_message, content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['Connection'] = 'close'
    return response


async def sse_position_stream(request):
    """
    Sends server-sent events of changed location
    """

    async def event_stream():

        # on async context request.user not accessible
        user = await aget_user(request)
           
        # only scouts with unit
        scouts = Scout.objects.exclude(unit__isnull=True)
        if user.is_authenticated:
            scouts = scouts.exclude(pk=user.id)

        if not await scouts.aexists():
            yield None

        last_position_id = await get_last_position_id()

        while True:

            async for scout in scouts:
                try:
                    last_position = await Position.objects.filter(
                        scout=scout, id__gt=last_position_id
                    ).alatest("recorded")
                except Position.DoesNotExist:
                    continue

                # async context way to access FK
                unit_id = getattr(scout, Scout._meta.get_field("unit").attname)

                last = {
                    "latlng": last_position.latlng,
                    "recorded": last_position.recorded,
                    "scout_id": scout.id,
                    "scout_name": scout.username,
                    "scout_unit_id": unit_id,
                }
                yield f"data: {json.dumps(last, cls=DjangoJSONEncoder)}\n\n"

                last_position_id = last_position.id

            await asyncio.sleep(2)  # Adjust sleep time as needed to reduce db queries.

    async def get_last_position_id() -> int:
        try:
            last_position = await Position.objects.all().alast()
            return last_position.id if last_position else 0
        except Position.DoesNotExist:
            return 0

    return StreamingHttpResponse(event_stream(), content_type="text/event-stream")

async def sse_marker_stream(request):
    """
    Sends server-sent events of changed markers
    """

    # on async context request.user not accessible
    user = await aget_user(request)

    if not user.is_authenticated:
        return create_sse_close_response("user is not authenticated")

    async def event_stream():
        last_marker_time = await get_last_marker_time() 

        while True:
            try:
                markers = Marker.objects.filter(time__gt=last_marker_time).prefetch_related('destination')
            except Marker.DoesNotExist:
                    continue

            async for marker in markers:

                if marker.type == Alert.DESTINATION:
                    destination = marker.destination
                    # async context access FK if not been prefetch
                    scout_id = getattr(destination, Destination._meta.get_field("scout").attname)
                    need_confirmation = not destination.is_confirmed and scout_id == user.id  # need to be confirmed for current user only
            
                last = {
                            "id": marker.id,
                            "latlng": marker.latlng,
                            "unit_id": getattr(marker, Marker._meta.get_field("unit").attname),
                            "title": marker.title,
                            "need_confirmation": need_confirmation,
                        }
                
                yield f"data: {json.dumps(last)}\n\n"
                last_marker_time = marker.time

            await asyncio.sleep(2)  # Adjust sleep time as needed to reduce db queries.


    async def get_last_marker_time():
        try:
            last_marker = await Marker.objects.all().alatest("time")
        except Marker.DoesNotExist:
             return timezone.now()
        return last_marker.time if last_marker else timezone.now()
        
    return StreamingHttpResponse(event_stream(), content_type="text/event-stream")

async def sse_message_stream(request):
    """
    Sends new messages to user
    """

    # on async context request.user not accessible
    user = await aget_user(request)

    if not user.is_authenticated:
        return create_sse_close_response("user is not authenticated")

    async def event_stream():
        last_message_time = await get_last_message_time() 

        while True:
            try:
                messages = Message.objects.filter(
                            Q(time__gt=last_message_time) & Q(receiver=user) # only for current user
                        ).order_by('-time')
            except Message.DoesNotExist:
                    continue

            async for message in messages:
                sender_id = getattr(message, Message._meta.get_field("sender").attname)
                sender = await Scout.objects.aget(id=sender_id)

                last = {
                            "id": message.id,
                            "latlng": message.latlng,
                            "time": str(message.time),  #note: DjangoJSON encoder can be used as well - see recorded position 
                            "text": message.text,
                            "sender_id": sender.id,
                            "sender": sender.username, 
                        }
                yield f"data: {json.dumps(last)}\n\n"
                last_message_time = message.time

            await asyncio.sleep(2)  # Adjust sleep time as needed to reduce db queries.


    async def get_last_message_time():
        try:
            last_message = await Message.objects.filter(receiver = user).alatest("time")
        except Message.DoesNotExist:
             return timezone.now()
        return last_message.time if last_message else timezone.now()
        
    return StreamingHttpResponse(event_stream(), content_type="text/event-stream")

async def sse_confirm_msg_stream(request):
    """
    Sends confirmation to sender that message has been Read
    """

    # on async context request.user not accessible
    user = await aget_user(request)

    if not user.is_authenticated:
        return create_sse_close_response("user is not authenticated")

    async def event_stream():
        last_message_time = await get_user_last_message_time() 

        while True:
            try:
                messages = Message.objects.filter(
                            Q(time__gt=last_message_time) & Q(sender=user) & Q(read=True) # message marked as read
                        ).order_by('-time')
            except Message.DoesNotExist:
                    continue

            async for message in messages:
                yield f"data: { message.id }\n\n"
                last_message_time = message.time

            await asyncio.sleep(3)  # Adjust sleep time as needed to reduce db queries.


    async def get_user_last_message_time():
        try:
            last_message = await Message.objects.filter(sender = user).alatest("time")
        except Message.DoesNotExist:
             return timezone.now()
        return last_message.time if last_message else timezone.now()
        
    return StreamingHttpResponse(event_stream(), content_type="text/event-stream")


def index(request):
    if not request.user.is_authenticated:
        return render(request, "scouts/index.html")
    messages = Message.objects.filter(
        Q(sender=request.user) | Q(receiver=request.user)
        ).annotate( 
            sender_display=Case (
            When (sender=request.user, then=Concat(
                Value('me -> '),
                'receiver__username',
                output_field=CharField()
            )),
            default='sender__username',  # field used for display
            output_field=CharField(),)   
        ).order_by('-time')
    return render(request, "scouts/index.html", {"messages": messages})

def init(request):
    """
    all initial data
    """
    data = []

    for unit in Unit.objects.all():
        scout_data = []
        for scout in unit.scouts.all():
            try:
                last_position = Position.objects.filter(scout=scout
                        ).latest("recorded")
            except Position.DoesNotExist:
                    continue

            destination_id = scout.destination.id if hasattr(scout, 'destination') else None
        
            scout_info = {
                "id": scout.id,
                "name": scout.username,
                "unit_id": scout.unit.id,
                "latlng": last_position.latlng,
                "destination_id": destination_id,
            }
            scout_data.append(scout_info)
        
        marker_data = []

        for marker in unit.markers.all():
            need_confirmation = False
            if marker.type == Alert.DESTINATION:
                need_confirmation = not marker.destination.is_confirmed and marker.destination.scout == request.user  
            
            marker_data.append({
                "id": marker.id,
                "type": marker.type,
                "title": marker.title,
                "description": marker.description,
                "latlng": marker.latlng,
                "need_confirmation": need_confirmation,
            })

        commander_id = unit.commander.id if unit.commander else None

        unit_data = {
            "id": unit.id,
            "title": unit.title,
            "color": unit.color,
            "commander_id": commander_id,
            "commander_name": unit.commander.__str__(),
            "scouts": scout_data,
            "markers": marker_data,
        }
        
        data.append(unit_data)

    return JsonResponse(data, safe=False, status=200)


@csrf_exempt  # csrfToken can be sent through XMLHttpRequest
@login_required
def save_position(request):
    data = json.loads(request.body)
    try:
        point = Position(
            scout=request.user, latlng=data["latlng"], recorded=data["timestamp"]
        )
        point.save()

    except Exception as e:
        print(e)
        return JsonResponse({"error": e.args[0]}, status=500)

    return JsonResponse({"all": "good"}, status=200)


@csrf_exempt 
@login_required
def set_destination(request):
    data = json.loads(request.body)
    try:
        scout = Scout.objects.get(pk=data["scout_id"])
        
        if not hasattr(scout, 'destination'):
            destination = Destination (
                type = Alert.DESTINATION, unit = scout.unit, title = scout.username, 
                scout=scout 
            )
        else:
            destination = scout.destination
            destination.latlng = data["latlng"]
            destination.time = timezone.now()
            destination.is_confirmed = False

        destination.latlng=data["latlng"]
        destination.save()

    except Exception as e:
        print(e)
        return JsonResponse({"error": e.args[0]}, status=500)

    return JsonResponse({"destination_id": destination.id, "destination_title": destination.title}, status=200)

@csrf_exempt 
@login_required
def save_message(request):
    data = json.loads(request.body)

    try:
        scout = Scout.objects.get(pk=data["receiver"])
        
        message = Message(sender = request.user, receiver = scout, 
                          text = data["message"], latlng = data["latlng"] )

        message.save()

    except Exception as e:
        print(e)
        return JsonResponse({"error": e.args[0]}, status=500)

    return JsonResponse({"id": message.id, "receiver": scout.username}, status=200)

@csrf_exempt 
@login_required
def mark_message_read(request):
    data = json.loads(request.body)
    try:
        
        message = Message.objects.get(pk=data["message_id"])
        message.read = True
        message.save()

    except Exception as e:
        print(e)
        return JsonResponse({"error": e.args[0]}, status=500)

    return JsonResponse({"messsage": "marked as read"}, status=200)

@csrf_exempt 
@login_required
def confirm_destination(request):
    data = json.loads(request.body)
    try:
        marker_id = data["marker_id"]
        marker = Marker.objects.get(pk=marker_id)
        
        if marker.type != Alert.DESTINATION:
            return JsonResponse({"error": "Provided marker_id: {marker_id} not a Destination type"}, status=500)
            
        destination = marker.destination
        destination.is_confirmed = True
        destination.save()

        # message to commander 
        message = Message(sender = request.user, receiver = marker.destination.scout.unit.commander, 
                          text = "Destination Confirmed", latlng = marker.latlng )

        message.save()

    except Exception as e:
        print(e)
        return JsonResponse({"error": e.args[0]}, status=500)

    return JsonResponse({"destination": "confirmed"}, status=200)


def login_view(request):
    if request.method == "POST":

        # Attempt to sign user in
        username = request.POST["username"]
        password = request.POST["password"]
        user = authenticate(request, username=username, password=password)

        # Check if authentication successful
        if user is not None:
            login(request, user)
            return HttpResponseRedirect(reverse("index"))
        else:
            return render(
                request,
                "scouts/login.html",
                {"message": "Invalid username and/or password."},
            )
    else:
        return render(request, "scouts/login.html")


def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse("index"))


def register(request):
    if request.method == "POST":
        username = request.POST["username"]
        email = request.POST["email"]

        # Ensure password matches confirmation
        password = request.POST["password"]
        confirmation = request.POST["confirmation"]
        if password != confirmation:
            return render(
                request, "scouts/register.html", {"message": "Passwords must match."}
            )

        # Attempt to create new user
        try:
            user = Scout.objects.create_user(username, email, password)
            user.save()
        except IntegrityError:
            return render(
                request, "scouts/register.html", {"message": "Username already taken."}
            )
        login(request, user)
        return HttpResponseRedirect(reverse("index"))
    else:
        return render(request, "scouts/register.html")
