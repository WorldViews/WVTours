
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

    async setCurrentTrack(track, setMapView) {
        console.log("-------------------------------");
        if (typeof track == "string") {
            var trackName = track;
            track = this.tracks[trackName];
            if (track == null) {
                console.log("*** track not yet loaded", trackName);
                var trackDesc = this.trackDescs[trackName];
                if (trackDesc == null) {
                    console.log("*** no such track as", trackName);
                    return;
                }
                var dataUrl = trackDesc.dataUrl;
                await this.loadTrackFromFile(trackDesc, dataUrl, this.map);
            }
            track = this.tracks[trackName];
            if (track == null) {
                console.log("*** unable to load track", trackName);
            }
        }

        this.currentTrack = track;
        var desc = track.desc;
        console.log("setCurrentTrack id: " + desc.id);
        var videoId = desc.youtubeId;
        var videoDeltaT = desc.youtubeDeltaT;
        if (this.display) {
            this.display.playVideo(videoId);
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

    dumpTracks() {
        console.log("================")
        console.log("tracks:");
        for (var key in this.tracks) {
            console.log("key", key, this.tracks[key]);
        }
        console.log("=================");
    }
}

class WVLApp extends WVMapApp {

    constructor() {
        super();
        this.LOCK_PLACEMARKS = true;
    }

    clickOnMap(e) {
        console.log("click on map e: " + e);
        console.log("latLng: " + e.latlng);
        var de = e.originalEvent;
        console.log("shift: " + de.shiftKey);
    }

    clickOnTrack = function (e, track) {
        console.log("click on track e: " + e);
        console.log("name: " + track.name);
        console.log("trail: " + track.trail);
        console.log("latLng: " + e.latlng);
        if (track != this.currentTrack)
            this.setCurrentTrack(track);
        var de = e.originalEvent;
        console.log("shift: " + de.shiftKey);
        var pt = [e.latlng.lat, e.latlng.lng];
        console.log("pt: " + pt);
        var ret = WV.findNearestPoint(pt, track.latLng);
        console.log("ret: " + JSON.stringify(ret));
        if (!ret) return;
        var i = ret.i;
        var trec = track.recs[i];
        console.log("trec: " + JSON.stringify(trec));
        if (!trec) return;
        var rt = trec.rt;
        console.log("****** seek to " + rt);
        if (this.display) {
            this.display.setPlayTime(rt);
        }
        var latLng = [trec.pos[0], trec.pos[1]];
        this.setPoint(latLng);
        this.trackWatchers.forEach(w => {
            w(track, trec, e);
        });
    }

    clickOnPlacemark(e, trackDesc, gpos) {
        this.map.setView(new L.LatLng(gpos[0], gpos[1]), 18, { animate: true });
    }

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

        //L.easyButton('fa-globe fa-fixed fa-lg', function (btn, map) {
        //    this.setViewHome();
        //}).addTo(map);

        this.cursor = L.marker([0, 0]);
        this.cursor.addTo(map);
        this.setPlayTime(0);
        this.addLayerControl();
    }

    // this loads the top level tours file that has all the tours
    // coordinate systems, indoor maps, etc.   It does not contain
    // the path data for each tour.  Those are stored in separate
    // JSON files
    async loadTracksFromFile(url, map) {
        console.log("**** loadTracksFromFile " + url);
        if (!map) map = this.map;
        var data = await WV.loadJSON(url);

        // This will process all the records, and load the track descriptors
        // into trackDescs for each track, but not load the path data.
        await this.handleLayerRecs(data, url, map);
        //
        // This will actually load the paths data.
        var lazy = true;
        if (lazy) {
            this.loadAllTracksData(map);
        }
        else {
            await this.loadAllTracksData(map);
        }
        console.log("all tracks loaded");
        return data;
    }

    async handleLayerRecs(tours, url, map) {
        console.log("got tours data from " + url);
        for (var i = 0; i < tours.records.length; i++) {
            //tours.records.forEach(async trackDesc => {
            var trackDesc = tours.records[i];
            if (WV.match(trackDesc.recType, "IndoorMap")) {
                console.log("**** indoor map ", trackDesc);
                var imap = trackDesc;
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
                //imlayer.edit();
                continue;
            }
            if (trackDesc.recType.toLowerCase() == "coordinatesystem") {
                console.log("coordinateSystem " + JSON.stringify(trackDesc));
                WV.addCoordinateSystem(trackDesc.coordSys, trackDesc);
                continue;
            }
            if (trackDesc.recType != "robotTrail") {
                continue;
            }
            var trackId = trackDesc.id;
            //console.log("tour.tourId: " + trackId);
            var dataUrl = trackDesc.dataUrl;
            //console.log("getting", dataUrl);
            this.trackDescs[trackId] = trackDesc;
            console.log("skipping loading of", trackDesc.id);
        }
    }

    // This goes through all loaded trackDescs and reads their data files.
    async loadAllTracksData(map) {
        console.log("loadAllTracksData");
        for (var id in this.trackDescs) {
            console.log("loadTracksData id", id);
            var trackDesc = this.trackDescs[id];
            var dataUrl = trackDesc.dataUrl;
            await this.loadTrackFromFile(trackDesc, dataUrl, map);
        }
    }

    //
    handleTrack(trackDesc, trackData, url, map) {
        var inst = this;
        var name = trackData.name;
        name = trackDesc.id; //********* Not sure if this is safe!!!
        console.log("handleTrack id:", trackDesc.id, " name:", name);
        trackData.desc = trackDesc; //*** NOTE: these set up a circular reference
        trackDesc.data = trackData;
        this.tracks[name] = trackData;
        //console.log("handleTrailData " + url);
        this.computeTrackPoints(trackData);
        trackData.trail = L.polyline(trackData.latLng, { color: '#3333ff', weight: 5 });
        trackData.trail.on('click', function (e) {
            inst.clickOnTrack(e, trackData);
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

    updateTrack(trackData) {
        console.log("updateTrack");
        this.computeTrackPoints(trackData);
        var desc = trackData.desc;
        trackData.trail.setLatLngs(trackData.latLng);
    }

    computeTrackPoints(trackData) {
        var desc = trackData.desc;
        var recs = trackData.recs;
        var h = 2;
        var coordSys = trackData.coordinateSystem;
        if (!coordSys) {
            coordSys = desc.coordSys;
        }
        if (!coordSys) {
            console.log("*** no coodinateSystem specified");
            coordSys = "GEO";
        }
        var latLng = [];
        for (var i = 0; i < recs.length; i++) {
            var pos = recs[i].pos;
            var lla = WV.xyzToLla(pos, coordSys);
            //latLng.push([pos[0], pos[1]]);
            latLng.push([lla[0], lla[1]]);
        }
        //console.log("latLng: "+latLng);
        trackData.latLng = latLng;
    }

    async loadTrackFromFile(trackDesc, url, map) {
        var data = await WV.loadJSON(url);
        this.handleTrack(trackDesc, data, url, map);
        return data;
    }



    dragPlacemark (e, trackDesc, gpos) {
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
    
    // set a cursor to given geo position
    setPoint (latLng) {
        if (!this.cursor) this.cursor = L.marker(latLng);
        this.cursor.setLatLng(latLng);
    }
    
    addLayerControl () {
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
    watchPositions () {
        console.log("************** watch Positions *************");
        this.sock = io(this.SIO_URL);
        this.sock.on('position', this.handleSIOMessage);
    }
    
    handleSIOMessage (msg) {
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

//var WVL = new WVLApp();


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
            await this.loadTours(toursURL);
        }
    }

    async initDisplay(videoId) {
        videoId = videoId || "Vp_f_rWnZdg";
        this.display = new WV.Display(null, "videoPlayer", { videoId });
        this.mapApp.display = this.display;
        await this.display.playerReady();
    }

    async loadTours(toursURL) {
        return this.mapApp.loadTracksFromFile(toursURL);
    }

    startWatcher() {
        var inst = this;
        this.watcherHandle = setInterval(() => inst.update(), 250);
    }

    update() {
        var t = this.display.getPlayTime();
        if (t == null)
            return;
        //console.log("update t", t);
        this.mapApp.setPlayTime(t);
    }

}


