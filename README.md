The “Scouts” web application is designed for geolocation-based activities, suitable for various uses such as scouting, military recon ops, or outdoor games. It allows users to navigate to destinations, communicate within their team, and track movements in real-time.

**Key Features:**
	
1.	User and Unit Management:
	◦	Users must be registered and allocated to a unit.
	◦	Units and their commanders are set up using the Django Administration module.

 2. Geolocation and Mapping:
	◦	Scouts’ positions are displayed on a map with icons and names.
	◦	Clicking on a scout’s icon shows their unit and commander’s name.
	◦	Features like ‘Auto Zoom’ and ‘Zoom to All’ enhance map navigation.
 3.	Real-Time Tracking:
	◦	Scouts can see their location and the locations of their unit members.
	◦	Location accuracy depends on device geolocation settings and GPS signal.
 4.	Simulation Mode:
	◦	Scouts can simulate movement to test visibility to others.
	◦	‘Auto Zoom’ helps follow the scout’s movement on the map.
 5.	Messaging:
	◦	Messaging is enabled within the same unit.
	◦	Messages appear on the map and in a message list.
	◦	Unread messages can be marked as read, notifying the sender.
 6.	Destination Setting:
	◦	Unit commanders can set new destinations for scouts.
	◦	Scouts receive notifications and can confirm new destination received.

 7.	Map Navigation:
	◦	Users can zoom and pan the map to navigate.
	◦	Map interaction is user friendly and mobile-responsive.

## <span style="color: red;"> Distinctiveness and Complexity: </span>

The "Scouts" web application stands out significantly from previous projects in both its core functionality and technical implementation:

1. Map and Geolocation-Driven: Unlike any previous project, this application is centered around interactive mapping and real-time geolocation tracking. It leverages the Leaflet.js library for advanced map controls and dynamic GeoJSON layer management.

2. Real-Time Updates via Server-Sent Events (SSE): A key distinguishing feature is the implementation of SSE for real-time updates. This allows for immediate server-to-client communication without client-side polling, a significant departure from the request-response model used in previous projects like the social network or e-commerce site. Notably, the application utilizes Daphne, an ASGI server, to handle SSE efficiently, enabling true asynchronous communication capabilities.

3. Asynchronous Server-Side Processing: The application utilizes async methods and async model querying in Django, a more advanced approach not seen in previous projects. This enables efficient handling of concurrent requests and real-time data processing.

4. Geolocation Simulation: A unique feature is the inclusion of a custom geolocation simulator (using simulator.js and geolocation-simulator.js). This tool allows for testing and demonstrating the application's real-time tracking capabilities, adding a layer of complexity not present in previous projects.

5. Device and Browser Capability Checking: The application includes sophisticated logic to verify device and browser geolocation support, assessing accuracy and providing appropriate user feedback. This level of device-specific optimization was not present in previous projects.

6. Enum Models in Django: The use of models.TextChoices for enumeration in Django models represents a more advanced data modeling approach compared to previous projects.

7. Mobile-Optimized Design: While responsiveness has been a consideration in past projects, this application goes further by optimizing for mobile devices with touch screen support and handling UI changes specific to mobile browsers when the window is not active.

8. Complex User Roles and Permissions: The implementation of distinct roles (scouts, commanders) with different capabilities (e.g., setting destinations) adds a layer of complexity to user management and access control.

9. Multi-User Real-Time Interaction: The combination of real-time tracking, messaging, and destination setting/confirming creates a dynamic, multi-user environment that is more complex than the static or semi-dynamic interactions in previous projects.

10. Integration of Multiple Technologies: The project seamlessly integrates various technologies (Django, JavaScript, Leaflet.js, SSE, Daphne, async programming) in a way that creates a cohesive, real-time application, demonstrating a higher level of technical integration than previous projects.

In summary, the "Scouts" application distinguishes itself through its unique focus on real-time geolocation tracking and mapping, advanced server-client communication methods (including the use of Daphne for SSE), and complex multi-user interactions. Its implementation of features like SSE, async Django calls, and geolocation simulation, combined with its practical application for team-based location tracking and communication, sets it apart as a more technically advanced and distinctly different project compared to previous assignments in the course.
#

### How to run application

***Prerequisites:***
  
`! Make sure to use >=Django 4.2 . Otherwise, you will get errors like    'TypeError: async_generator object is not iterable..' when using async calls.`


****install daphne:****   `pip install django daphne`

****apply migration:****  `python manage.py migrate`

****create superuser:****  `python manage.py createsuperuser`

****start the app:****  `python manage.py runserver`


#### Usage Tips:
-	Ensure geolocation services are enabled on the device.
-	Allow browser permission for location access.
-	Use the ‘Start Simulator’ to test movement visibility.
-	Utilize map navigation features for better control.

#### Usage instructions:

1. **Initial Setup**:
   - Create a Django 'SuperUser' to access the Administration module.
   - Use Django Administration module to set up units, commanders, and allocate scouts.
   - Assign scouts to units: `http://localhost:8000/admin/scouts/scout/`
   - Allocate commanders to units: `http://localhost:8000/admin/scouts/unit/`

2. **User Roles**:
   - A registered user becomes a Scout when allocated to a unit.
   - Only commanders can appoint destinations to scouts.

3. **Geolocation**:
   - Enable device geolocation and browser permission to view your position on the map.
   - Your location appears as a blinking orange circle. Click it to see coordinates.
   - Accuracy (in meters) and status (Red/Green) are shown in the toolbar.
   - Desktop browser accuracy may vary depending on the provider.

4. **Map Features**:
   - Scout positions are shown as icons with names on the map.
   - Click a scout's icon to see their unit and commander's name.
   - Logged-in scouts see their unit name in brackets next to their name.
   - Scouts can view their location, unit members' locations, and other units' scouts.

5. **Map Navigation**:
   - Use 'Auto Zoom' to automatically focus on location changes.
   - 'Zoom to All' brings all map items into view.
   - To set destinations outside current view, scroll to zoom or drag the map.
   - Use Shift + arrow keys for navigation (click on map while holding Shift).

6. **Simulation**:
   - Use 'Start Simulator' to test movement visibility.
   - Enable 'Auto Zoom' to follow simulated movement.

7. **Messaging**:
   - Messaging is limited to scouts within the same unit.
   - To send a message: click scout's icon, press 'Message', type, then 'Send' or hit Enter.
   - Messages appear on the receiver's map and in the messages list.
   - Mark messages as read via map pop-up or messages list.
   - Unread messages pop up on login and show 'unread' status.

8. **Destination Setting** (Commanders only):
   - Click scout's icon, press 'Set Destination'.
   - Click on map to set new destination (cursor changes to cross-hair).
   - Scouts receive a pop-up message and map marker for new destinations.
   - Scouts confirm destinations; commanders receive confirmation messages.
   - Unconfirmed destinations remain visible until confirmed.

9. **Mobile Usage**:
   - The app is mobile-friendly.
   - On smaller screens, pull down the browser page from the top and flick up for full view.
---

### What key files are there:

**models.py**
Defines several models: Scout (extends AbstractUser), Unit (with a unique title and commander), Position (stores spatial points for Scouts), Marker (alerts for Units), Destination (special Marker for Scouts), and Message (communication between Scouts). Includes Color and Alert enums for predefined choices.

**index.html**
Main UI template that serves as the core of the application's frontend. It incorporates the Leaflet map control, a map interaction toolbox menu, and a dynamic messages list. The file includes essential references to the Leaflet library's JavaScript and CSS files, ensuring proper map functionality and styling.

**script.js**
File manages all UI interactions, with a focus on map manipulation and its associated navigation controls. It handles Server-Sent Events (SSE) subscriptions and events, enabling real-time updates. The file also contains functions for making API fetch calls to the server, facilitating seamless communication between the frontend and backend.

**geolocation-simulator.js and simulator.js**
These files contain the logic for simulating geolocation data. They are crucial for testing SSE messaging and map interactions in scenarios where actual geolocation changes are not feasible. This simulation capability allows for comprehensive testing and demonstration of the app's real-time tracking features.

**styles.css**
File defines styles for key dynamic elements such as the blinking position indicator, message status, and map feature tooltips.

The static folder also contains a collection of color-coded icons. These icons are utilized to represent various markers and features on the map

---

References:
- Leaflet  interactive map v. 1.9.4  https://leafletjs.com/
- Geolocation-simulator https://github.com/russellsamora/geolocation-simulator  
- Server Sent Events implementation using Daphne    

  - https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/daphne/


  - https://www.photondesigner.com/articles/server-sent-events-daphne 
	the client side, uses the standard EventSource API, which is supported by all browsers and makes using an SSE endpoint pretty easy. The EventSource instance establishes a persistent connection to an HTTP server to receive the events sent by the server in a text/event-stream format

------------------------------------