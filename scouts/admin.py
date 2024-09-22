from django.contrib import admin
from .models import Scout, Unit, Position, Marker, Destination, Message

# super user: admin p: 1 team alpha
# scout b1 p: 1   (bravo team commander)

class ScoutAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "unit")



class UnitAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "color", "commander")


class PositionAdmin(admin.ModelAdmin):
    list_display = ("id", "latlng", "recorded")


class MarkerAdmin(admin.ModelAdmin):
    list_display = ("id", "type", "unit", "title", "description", "time")

class DestinationAdmin(admin.ModelAdmin):
    list_display = ("id", "scout", "title")

class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "sender", "receiver", "time")


# Register your models here.
admin.site.register(Scout, ScoutAdmin)
admin.site.register(Unit, UnitAdmin)
admin.site.register(Position, PositionAdmin)
admin.site.register(Marker, MarkerAdmin)
admin.site.register(Destination, DestinationAdmin)
admin.site.register(Message, MessageAdmin)
