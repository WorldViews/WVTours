# WVTours
Web pages for viewing video tours.  Most of the video is 360, but any video can be used that has matching GPS trails, and some of the
video is captured by drones.  The page shows a youtube video together with a map indicating trail positions.   The page is served at
[https://worldviews.org/WVTours/wvtours.html](https://worldviews.org/WVTours/wvtours.html)


# Usage

This project is implemented client side, using the Leaflet map system.  The only
server side requirement in this version is serving static files.  To run this locally
any server could be used, or you could run the simple python server using 
```
runPyServer.bat
```
or just ```python -m http.server 80```

Then in a browser access http://localhost/wvtours.html

# Database Format

The database consists of a master file called tours_data.json which lists the collection of tours
together with a limitted amount of metadata for each tour.   Additionally each tour has a separate
JSON path file listing the paths and timing.   Some of the paths included here were produced by
experiments with robots or various camera systems, and contain extraneous metadata.   For the
purposes of this application the only metadata for each tour is its id, description, and dataURL
for accessing the path

| Field      |    Meaning      |
|------------|-----------------|
| id          | Unique identifier for the tour |
| recType     | Type of record - should be *robotTour* for a tour |
| description | Short text description         |
| robotType   | The collection mechanism, e.g. drone, wheelchar, robot, etc. |
| dataUrl     | The URL of the path data file |
| youtubeId   | The unique youtuve video id   |
| youtubeDeltaT | The relative difference between video playTime and path position along a trail. |
| coordSys    | An optional coordinate system for paths that may be in cartesian coordinates, say 
                building coordinates.   If not coodinates are given, geo coordinates latitide, longitude
                are assumed.
 
 







