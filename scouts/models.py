from django.db import models
from django.contrib.auth.models import AbstractUser


class Color(models.TextChoices):
    RED = "red"
    GREEN = "green"
    BLUE = "blue"


class Alert(models.TextChoices):
    INFO = "info"
    WARN = "warn"
    DANGER = "danger"
    DESTINATION = "dest"


class Scout(AbstractUser):
    unit = models.ForeignKey(
        "Unit", on_delete=models.DO_NOTHING, related_name="scouts", blank=True, null=True
    )


class Unit(models.Model):
    title = models.CharField(max_length=20, unique=True)
    
    # even if scout doesn't have a unit assigned, beeing a commander makes it relation to unit
    commander = models.OneToOneField(
        Scout,
        on_delete=models.DO_NOTHING,
        related_name="unit_under_command",
        blank=True,
        null=True,
    )
    color = models.CharField(max_length=10, choices=Color.choices)

    def __str__(self):
        return f"{self.title}"


# note: all spatial points will be stored as LatLong, ex: {lat: 42.34785733333333, lng: -71.07324241666666}  LatLng(42.352124, -71.069802)


class Position(models.Model):
    scout = models.ForeignKey(
        Scout, on_delete=models.CASCADE, related_name="way_points"
    )

    # spatial database only (PostgreSQL and PostGIS)
    # point = models.PointField(), GeometryField, PolygonField
    latlng = models.CharField(max_length=64)
    recorded = models.DateTimeField(
        auto_now_add=True
    )  # timestamp comes from Map, should it be converted to local time?


class Marker(models.Model):
    type = models.CharField(max_length=10, choices=Alert.choices)
    # marker is visible to unit
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="markers")
    title = models.CharField(max_length=20)
    description = models.CharField(max_length=64, null=True, blank=True)
    latlng = models.CharField(max_length=64)
    #audit field
    time = models.DateTimeField(auto_now_add=True)

# only one destination per scout (PK)
class Destination(Marker):
    scout = models.OneToOneField(
        Scout, on_delete=models.CASCADE, related_name="destination", primary_key=True
    )
    is_confirmed = models.BooleanField(default=False)


class Message(models.Model):
    text = models.CharField(max_length=64)
    time = models.DateTimeField(auto_now_add=True)
    sender = models.ForeignKey(Scout, on_delete=models.CASCADE, related_name="sent")
    receiver = models.ForeignKey(
        Scout, on_delete=models.CASCADE, related_name="received"
    )
    latlng = models.CharField(
        max_length=64, null=True, blank=True
    )  # sender's geolocation at the time message was sent
    read = models.BooleanField(default=False)
