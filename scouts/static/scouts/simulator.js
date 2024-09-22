function start_simulator(lat, lng) {

    var coordinates = [
        { latitude: lat, longitude: lng },
    ];

    //make some random coordinates to north (bearing 0)
    for (let index = 0; index < 1000; index++) {
        var last = coordinates[coordinates.length - 1];
        coordinates.push(createCoord(last.latitude, last.longitude, 0, 100));  // meters  
    }

    // simulates moving along coordinates with speed. !note: not following exact coords param
    var simulator = GeolocationSimulator({ coords: coordinates, speed: 30 }); // km/h

    simulator.start();
}

function calculateNewCoordinates(lat1, lng1, bearing, distance) {
    const earthRadius = 6371 * 1000; // Earth's radius in meters
    const lat2 = lat1 + (distance * Math.cos(bearing)) / earthRadius;
    const lng2 = lng1 + (distance * Math.sin(bearing)) / (earthRadius * Math.cos(lat1));
    return { latitude: lat2, longitude: lng2 };
}

function createCoord(latitude, longitude, bearing, distance) {
    const bearing_rad = (bearing * Math.PI) / 180;

    const EARTH_RADIUS = 6378.137;

    const init_lat = (latitude * Math.PI) / 180;
    const init_lon = (longitude * Math.PI) / 180;

    const radian_lat = (Math.asin(Math.sin(init_lat) * Math.cos(distance / EARTH_RADIUS) + Math.cos(init_lat) * Math.sin(distance / EARTH_RADIUS) * Math.cos(bearing_rad)));

    const final_lon = (180 / Math.PI) * (init_lon + Math.atan2(Math.sin(bearing_rad) * Math.sin(distance / EARTH_RADIUS) * Math.cos(init_lat), Math.cos(distance / EARTH_RADIUS) - Math.sin(init_lat) * Math.sin(radian_lat)));

    const final_lat = (180 / Math.PI) * radian_lat;

    return { latitude: final_lat, longitude: final_lon };
}