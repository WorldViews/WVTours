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

# Database Access and File Format

The database consists of a master file called tours_data.json which lists the collection of tours
together with a limitted amount of metadata for each tour.   Additionally each tour has a separate
JSON path file listing the paths and timing.   Some of the paths included here were produced by
experiments with robots or various camera systems, and contain extraneous metadata.   For the
purposes of this application the relevant metadata are the fields shown here

| Field      |    Meaning      |
|------------|-----------------|
| id          | Unique identifier for the tour |
| recType     | Type of record - should be *robotTour* for a tour |
| description | Short text description         |
| robotType   | The collection mechanism, e.g. drone, wheelchar, robot, etc. |
| dataUrl     | The URL of the path data file |
| youtubeId   | The unique youtuve video id   |
| youtubeDeltaT | The relative difference between video playTime and path position along a trail. |
| coordSys    | An optional coordinate system for paths that may be in cartesian coordinates, say building coordinates.   If not coordSys is *geo* or is not given, geographic  coordinates (latitide, longitude) are assumed.

In addition to the records for each tour in the master file, each tour has its own path file.  Various metadata may be included but the relevant fields for this
application are

| Field      |    Meaning      |
|------------|-----------------|
| startTime  | this can be given as an absolute time since epoc.   However this the path trails are specified as relative times, so for the purpose of playing video matching trail positions, this is not used. |
| duration   |  The length of the trail / video  |
| recs       |  List of JSON's containing *pos*, *rt* and *time*, where *pos* is position [x,y] or [x,y,z], *rt* is relative time. |
 
The database can be accessed using the JavaScript class TourDB.  This usage is

```
var tdb = new TourDB()
await tdb.loadTours("./data/tour_data.json")
```

This will create a tour db, and load the master file.  It also will begin loading all tours, but it returns as soon as the master file
has been successfully read and processed, it does not wait until all paths are loaded, which could take a long time if there are many paths.
However, for a given tour, calling
```
var trackData = await tdb.getTourData(tourName)
```
Will return the trackData when it becomes available.









