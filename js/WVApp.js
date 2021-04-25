
"use strict";

// This is a base app for displaying tours on a map.
// We may have several versions of Maps that we use, Leaflet, Cesium, etc.
class WVMapApp {
    constructor() {
        this.display = null;
        this.trackDescs = {};
        this.tracks = {};
        this.currentTrack = null;
        this.cursor = null;
        this.currentPlayTime = 0;
        this.lastSeekTime = 0;
        this.playSpeed = 0;
        this.homeLatLng = null;
        this.homeBounds = null;
        this.homeZoom = 10;
        this.trackWatchers = [];
        this.toursUrl = "/data/tours_data.json";
        this.indoorMaps = {};
        this.SIO_URL = window.location.protocol + '//' + window.location.hostname + ":7000/";
        this.sock = null;
        this.clientMarkers = {};
        this.trackLayer = null;
        this.layers = {};
        this.layerControl = null;
        this.osm = null;
        this.googleSat = null;
        this.tourDB = new WVTourDB(this);
    }

    // A watcher function has signature
    // watcher(track, trec, event)
    registerTrackWatcher(fun) {
        this.trackWatchers.push(fun);
    }

    getClockTime() {
        return new Date() / 1000.0;
    }

    getPlayTime(t) {
        var t = this.getClockTime();
        var t0 = this.lastSeekTime;
        var dt = (t - t0) * this.playSpeed;
        this.setPlayTime(this.currentPlayTime + dt);
        return this.currentPlayTime;
    }

    setPlayTime(t) {
        this.lastSeekTime = this.getClockTime();
        this.currentPlayTime = t;
        if (!this.currentTrack) return;
        var ret = WV.findPointByTime(this.currentTrack, t);
        if (!ret) return;
        this.setPoint(ret.nearestPt);
    }

    setViewHome() {
        var ll = this.homeLatLng;
        this.map.setView(new L.LatLng(ll.lat, ll.lng), this.homeZoom);
    }

    // for debugging, this can be called from the console
    dump() {
        this.tourDB.dumpTours();
    }
}

//
// This is a subclass of MapApp using Leaflet.
//
class WVLApp extends WVMapApp {

    constructor() {
        super();
        this.LOCK_PLACEMARKS = true;
    }

    // doesn't do anything, but is example placeholder code for
    // clicking on map.
    clickOnMap(e) {
        console.log("click on map e: " + e);
        console.log("latLng: " + e.latlng);
        var de = e.originalEvent;
        console.log("shift: " + de.shiftKey);
    }

    // The user clicked on a trail track.  We need to determine
    // if it is a different video, and if so switch to that video,
    // and must determine the correct playtime for the point that
    // was clicked on.
    clickOnTrack = function (e, tour, track) {
        console.log("click on track e: " + e);
        console.log("name: " + track.name);
        console.log("tour.id", tour.id);
        console.log("latLng: " + e.latlng);
        //if (track != this.currentTrack) {
        //    // this may switch to new video.
        //    this.setCurrentTrack(tour.id);
        //}
        var de = e.originalEvent;
        var pt = [e.latlng.lat, e.latlng.lng];
        var ret = WV.findNearestPoint(pt, track.latLng);
        console.log("ret: " + JSON.stringify(ret));
        if (!ret) return;
        var i = ret.i;
        var trec = track.recs[i];
        console.log("trec:", trec);
        if (!trec) return;
        var rt = trec.rt;
        console.log("****** seek to " + rt);
        if (this.display) {
            this.display.setPlayTime(rt);
        }
        if (track != this.currentTrack) {
            // this may switch to new video.
            this.setCurrentTrack(tour.id, false, rt);
        }
        var latLng = [trec.pos[0], trec.pos[1]];
        this.setPoint(latLng);
        this.trackWatchers.forEach(w => {
            w(track, trec, e);
        });
    }

    // if user clicks on placemark, animate movement to center that placemark
    clickOnPlacemark(e, trackDesc, gpos) {
        this.map.setView(new L.LatLng(gpos[0], gpos[1]), 18, { animate: true });
    }

    //
    // Create and set up a basic Leaflet map view
    //
    initmap(latlng, bounds) {
        // set up the map
        var map = new L.Map('map');
        this.map = map;
        this.trackLayer = L.layerGroup();
        this.layers['Trails'] = this.trackLayer;
        this.trackLayer.addTo(map);
        this.homeLatLng = latlng;
        this.homeBounds = bounds;
        map.on('click', this.clickOnMap);

        // create the tile layer with correct attribution
        var osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        var osmAttrib = 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
        //var osm = new L.TileLayer(osmUrl, {minZoom: 17, maxZoom: 19, attribution: osmAttrib});
        var osm = new L.TileLayer(osmUrl, { minZoom: 5, maxZoom: 21, attribution: osmAttrib });
        this.osm = osm;
        // Google areal imagery layer
        this.googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        });
        // start the map in South-East England
        //map.setView(new L.LatLng(latlng.lat, latlng.lng),18);
        map.setView(new L.LatLng(latlng.lat, latlng.lng), 10);
        map.addLayer(osm);
        //map.addLayer(googleSat);

        this.cursor = L.marker([0, 0]);
        this.cursor.addTo(map);
        this.setPlayTime(0);
        this.addLayerControl();
    }

    // This causes the TourDB to access tours data and make
    // callbacks when indoor map records, or tour path data
    // are loaded.
    async loadTours(url) {
        return await this.tourDB.loadTours(url);
    }

    // This is called by the TourDB when an indoor map record has been read
    handleIndoorMap(rec) {
        console.log("*** WVApp.handleIndoorMap ***");
        if (!WV.match(rec.recType, "IndoorMap")) {
            error("handleIndoorMap called with wrong record");
            return;
        }
        console.log("**** indoor map ", rec);
        var imap = rec;
        var p1 = imap.p0;
        var p2 = [p1[0] + .001, p1[1]];
        var p3 = [p1[0], p1[1] + 0.001];
        var imlayer = new WV.ImageLayer(imap.imageUrl, this, {
            p1: p1,
            width: imap.width,
            height: imap.height,
            heading: imap.heading
        });
        //	    var imlayer = new WV.ImageLayer(imap.imageUrl, {p1: p1, p2: p2, p3: p3});
        this.indoorMaps[imap.id] = imlayer;
    }

    // This is called by the tourDB when a tour's track data
    // has been loaded
    handleTrack(tour, trackData) {
        console.log("WVApp.handleTrack", tour);
        var inst = this;
        var map = this.map;
        var trackDesc = tour;
        trackData.trail = L.polyline(trackData.latLng, { color: '#3333ff', weight: 5 });
        trackData.trail.on('click', function (e) {
            inst.clickOnTrack(e, tour, trackData);
        });
        //trackData.trail.addTo(map);
        var trackLayerName = trackDesc.layerName;
        if (!trackLayerName) trackLayerName = "Trails";
        var trackLayer = this.layers[trackLayerName];
        if (!trackLayer) {
            console.log("*** adding trackLayer", trackLayerName);
            trackLayer = L.layerGroup();
            this.layers[trackLayerName] = trackLayer;
            if (this.layerControl) this.layerControl.addOverlay(trackLayer, trackLayerName);
        }
        trackData.trail.addTo(trackLayer);
        var gpos = trackData.latLng[0];
        trackDesc.map = map;
        // trackDesc.placemark = L.marker(gpos, { draggable: true });
        trackDesc.placemark = L.marker(gpos, { draggable: false });
        trackDesc.placemark.addTo(map);
        //    trackDesc.placemark.on('click', function (e) {
        //	map.setView(new L.LatLng(gpos[0], gpos[1]),18, {animate: true});
        //    });
        trackDesc.placemark.on('click', e => {
            this.clickOnPlacemark(e, trackDesc, gpos);
        });
        trackDesc.placemark.on('drag dragend', e => {
            this.dragPlacemark(e, trackDesc, gpos);
        });
    }
    
    // This sets the current track associated with the video
    // that may be shown.   As time is updated, the placemark
    // on this trail will be updated.  Optionally set the map
    // view to show this track.
    async setCurrentTrack(trackName, setMapView, playTime) {
        console.log("-------------------------------");
        console.log("setCurrentTrack", trackName, setMapView, playTime);
        var tour = await this.tourDB.getTourData(trackName);
        var track = tour.trackData;
        this.currentTrack = track;
        var desc = track.desc;
        console.log("setCurrentTrack id: " + desc.id);
        var videoId = desc.youtubeId;
        var videoDeltaT = desc.youtubeDeltaT;
        if (this.display) {
            this.display.playVideo(videoId, playTime);
        }
        console.log("videoId: " + videoId);
        console.log("deltaT: " + videoDeltaT);
        if (setMapView) {
            if (!track.latLng) {
                console.log("***** no latlng *****");
                return;
            }
            var [lat, lng] = track.latLng[0];
            //alert("lat lng "+lat+"    " + lng);
            if (lat && lng) {
                this.map.setView(new L.LatLng(lat, lng), 19, { animate: true });
            }
        }
    }

    // This is not currently tested or fully functional.  It
    // was used in an earlier version as part of a mechanism for
    // adjusting trails.
    dragPlacemark(e, trackDesc, gpos) {
        console.log("dragging placemark gpos: " + gpos);
        var placemark = trackDesc.placemark;
        if (!this.LOCK_PLACEMARKS) {
            var t1 = WV.getClockTime();
            var npt = placemark.getLatLng();
            //placemark.setLatLng(npt);
            var data = trackDesc.data;
            //var coordSys = data.coordinateSystem;
            var coordSys = trackDesc.coordSys;
            console.log("coordSys: " + coordSys);
            var cs = WV.coordinateSystems[coordSys];
            console.log("cs before: " + JSON.stringify(cs));
            //WV.updateCoordinateSystem(cs, npt.lat, npt.lng);
            cs.update(npt.lat, npt.lng);
            console.log("cs after: " + JSON.stringify(cs));
            this.updateTrack(trackDesc.data);
            var t2 = WV.getClockTime();
            console.log("updated in " + (t2 - t1) + " secs");
        }
    }

    // used with drag placemark to update all points on path
    // to new positions.
    updateTrack(trackData) {
        console.log("updateTrack");
        this.computeTrackPoints(trackData);
        var desc = trackData.desc;
        trackData.trail.setLatLngs(trackData.latLng);
    }


    // set a cursor to given geo position.  This is used during
    // playback to update position corresponding to camera position
    setPoint(latLng) {
        if (!this.cursor) this.cursor = L.marker(latLng);
        this.cursor.setLatLng(latLng);
    }

    // Set up Leaflet layer contrl (shows in upper right) that has map layer
    // types, and will show trail types.
    addLayerControl() {
        var maps = {
            'OpenStreetMap': this.osm,
            'Google Sattelite': this.googleSat
        };
        this.layerControl = L.control.layers(maps, this.layers).addTo(this.map);
    };

    /********************************************************************************/
    // Section for live updates of agents moving on map.  This uses
    // socket.io to get messages sent by various apps.  The messages can
    // specify positions of an agent.  This was used to show live drone
    // positions for example.
    //
    watchPositions() {
        console.log("************** watch Positions *************");
        this.sock = io(this.SIO_URL);
        this.sock.on('position', this.handleSIOMessage);
    }

    // handle a socket.io message that proves lat and lon for a named client.
    handleSIOMessage(msg) {
        console.log("WVL received position msg: " + JSON.stringify(msg));
        var clientId = msg.clientId;
        var marker = this.clientMarkers[clientId];
        var lat = msg.position[0];
        var lng = msg.position[1];
        if (marker) {
            console.log("AdjustMarker " + clientId);
            //clientMarkers[clientId].setLatLng(L.latLng(lat,lng));
            marker.setLatLng([lat, lng]);
        } else {
            console.log("CreateMarker " + clientId);
            var marker = L.marker([lat, lng]).addTo(this.map);
            this.clientMarkers[clientId] = marker;
        }
    }

}


//
// This is the top level app that includes a Leaflet based map app
// and a youtube video display.
//
WV.LeafletVideoApp = class {
    constructor() {
        // for debugging, pick lat lon we are familiar with
        // that shows some video trails
        var lat = 36.98284;
        var lon = -122.06107;
        //var pano = new PanoProxy(display);
        var latlon = { lat, lng: lon };
        this.mapApp = new WVLApp();
        this.mapApp.initmap(latlon);
        this.startWatcher();
    }

    // move the primary initialization to an init
    // function, so it can be an async function.
    async init(toursURL, videoId) {
        await this.initDisplay(videoId);
        if (toursURL) {
            await this.mapApp.loadTours(toursURL);
        }
    }

    async initDisplay(videoId) {
        videoId = videoId || "Vp_f_rWnZdg";
        this.display = new WV.Display(null, "videoPlayer", { videoId });
        this.mapApp.display = this.display;
        await this.display.playerReady();
    }

    // start an update interval timer.
    startWatcher() {
        var inst = this;
        this.watcherHandle = setInterval(() => inst.update(), 250);
    }

    // This is causes the place markers for the video position to
    // get updated.
    update() {
        var t = this.display.getPlayTime();
        if (t == null)
            return;
        this.mapApp.setPlayTime(t);
    }

}


