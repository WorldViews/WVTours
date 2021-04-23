
"use strict";

var WVL = {};

WVL.display = null;
WVL.trackDescs = {};
WVL.tracks = {};
WVL.currentTrack = null;
WVL.cursor = null;
WVL.currentPlayTime = 0;
WVL.lastSeekTime = 0;
WVL.playSpeed = 0;
WVL.homeLatLng = null;
WVL.homeBounds = null;
WVL.homeZoom = 10;
WVL.trackWatchers = [];
WVL.toursUrl = "/data/tours_data.json";
WVL.indoorMaps = {};
WVL.SIO_URL = window.location.protocol + '//' + window.location.hostname + ":7000/";
WVL.sock = null;
WVL.clientMarkers = {};
WVL.trackLayer = null;
WVL.layers = {};
WVL.layerControl = null;
WVL.osm = null;
WVL.googleSat = null;

WVL.ImageLayer = class {
    constructor(imageUrl, opts) {
        this.map = WVL.map;
        this.marker1 = null;
        this.marker2 = null;
        this.marker3 = null;
        if (!(opts.p1 && opts.width && opts.height)) {
            console.log("**** bad arguments to WV.ImageLayer ****");
            return;
        }
        this.width = opts.width;
        this.height = opts.height;
        this.heading = opts.heading || 0;
        console.log("width: " + this.width);
        console.log("height: " + this.height);
        console.log("heading: " + this.heading);
        this.point1 = new L.LatLng(opts.p1[0], opts.p1[1]);
        this._updatePoints();
        this.overlay = L.imageOverlay.rotated(imageUrl, this.point1, this.point2, this.point3, {
            opacity: 0.8,
            interactive: false
        });
        this.overlay.addTo(WVL.map);
        //this.addGrips();
        //this.fitBounds();
    }

    fitBounds() {
        var bounds = new L.LatLngBounds(this.point1, this.point2).extend(this.point3);
        this.map.fitBounds(bounds);
    }

    edit() {
        var inst = this;
        if (!this.marker1) {
            this.marker1 = L.marker(this.point1, { draggable: true }).addTo(this.map);
            this.marker1.on('drag dragend', () => {
                inst.handleTranslate();
            });
        }
        if (!this.marker2) {
            this.marker2 = L.marker(this.point2, { draggable: true }).addTo(this.map);
            this.marker2.on('drag dragend', () => {
                inst.handleRotate();
            });
        }
        this.marker1._bringToFront();
        this.marker2._bringToFront();
    }

    handleTranslate() {
        console.log("handleTranslate");
        this.point1 = this.marker1.getLatLng();
        this._updatePoints();
        this.dump();
    }

    handleRotate() {
        console.log("handleRotate");
        var point2 = this.marker2.getLatLng();
        var h = L.GeometryUtil.bearing(this.point1, point2);
        this.setHeading(h);
    }

    setHeading(h) {
        console.log("setHeading " + h);
        this.heading = h;
        this._updatePoints();
    }

    setWidth(w) {
        console.log("setWidth " + w);
        this.width = w;
        this._updatePoints();
    }

    setHeight(h) {
        console.log("setHeight " + h);
        this.height = h;
        this._updatePoints();
    }

    _updatePoints() {
        console.log(" p1: " + this.point1);
        //this.point2 = L.GeometryUtil.destination(this.point1, 90+this.heading, this.width);
        //this.point3 = L.GeometryUtil.destination(this.point1, 180+this.heading, this.height);
        this.point2 = L.GeometryUtil.destination(this.point1, this.heading, this.width);
        this.point3 = L.GeometryUtil.destination(this.point1, 90 + this.heading, this.height);
        if (this.overlay) this.overlay.reposition(this.point1, this.point2, this.point3);
        this.updateGrips();
        this.dump();
    }

    updateGrips(h) {
        if (this.marker1) this.marker1.setLatLng(this.point1);
        if (this.marker2) this.marker2.setLatLng(this.point2);
        if (this.marker3) this.marker3.setLatLng(this.point3);
    }

    dump() {
        var p1 = this.point1;
        var obj = { 'heading': this.h12, 'origin': [p1.lat, p1.lng] };
        console.log("map: " + JSON.stringify(obj));
    }
}

// A watcher function has signature
// watcher(track, trec, event)
WVL.registerTrackWatcher = function (fun) {
    WVL.trackWatchers.push(fun);
};

WVL.getClockTime = function () {
    return new Date() / 1000.0;
};

WVL.getPlayTime = function (t) {
    var t = WVL.getClockTime();
    var t0 = WVL.lastSeekTime;
    var dt = (t - t0) * WVL.playSpeed;
    WVL.setPlayTime(WVL.currentPlayTime + dt);
    return WVL.currentPlayTime;
};

WVL.setPlayTime = function (t) {
    WVL.lastSeekTime = WVL.getClockTime();
    WVL.currentPlayTime = t;
    if (!WVL.currentTrack) return;
    var ret = WVL.findPointByTime(WVL.currentTrack, t);
    if (!ret) return;
    WVL.setPoint(ret.nearestPt);
};

WVL.setViewHome = function () {
    var ll = WVL.homeLatLng;
    WVL.map.setView(new L.LatLng(ll.lat, ll.lng), WVL.homeZoom);
};

WVL.distanceSquared = function (pt1, pt2) {
    var dx = pt1[0] - pt2[0];
    var dy = pt1[1] - pt2[1];
    var d2 = dx * dx + dy * dy;
    //console.log("dsq "+pt1+" "+pt2+"   d2: "+d2);
    return d2;
};

// linear interp... 
WVL.lerp = function (pt1, pt2, f, pt) {
    var x = (1 - f) * pt1[0] + f * pt2[0];
    var y = (1 - f) * pt1[1] + f * pt2[1];
    return [x, y];
};

WVL.timerFun = function (e) {
    //var t = WVL.getPlayTime();
    //console.log("*** tick playTime: "+t);
    //setTimeout(WVL.timerFun, 100);
};

WVL.clickOnMap = function (e) {
    console.log("click on map e: " + e);
    console.log("latLng: " + e.latlng);
    var de = e.originalEvent;
    console.log("shift: " + de.shiftKey);
};

WVL.dumpTracks = function () {
    console.log("================")
    console.log("tracks:");
    for (var key in WVL.tracks) {
        console.log("key", key, WVL.tracks[key]);
    }
    console.log("=================");
}

WVL.setCurrentTrack = async function (track, setMapView) {
    console.log("-------------------------------");
    if (typeof track == "string") {
        var trackName = track;
        track = WVL.tracks[trackName];
        if (track == null) {
            console.log("*** track not yet loaded", trackName);
            var trackDesc = WVL.trackDescs[trackName];
            if (trackDesc == null) {
                console.log("*** no such track as", trackName);
                return;
            }
            var dataUrl = trackDesc.dataUrl;
            await WVL.loadTrackFromFile(trackDesc, dataUrl, WVL.map);
        }
        track = WVL.tracks[trackName];
        if (track == null) {
            console.log("*** unable to load track", trackName);
        }
    }

    WVL.currentTrack = track;
    var desc = track.desc;
    console.log("setCurrentTrack id: " + desc.id);
    var videoId = desc.youtubeId;
    var videoDeltaT = desc.youtubeDeltaT;
    if (WVL.display) {
        WVL.display.playVideo(videoId);
    }
    console.log("videoId: " + videoId);
    console.log("deltaT: " + videoDeltaT);
    if (setMapView) {
        if (!track.latLng) {
            console.log("***** not latlng *****");
            return;
        }
        var [lat, lng] = track.latLng[0];
        //alert("lat lng "+lat+"    " + lng);
        if (lat && lng) {
            WVL.map.setView(new L.LatLng(lat, lng), 19, { animate: true });
        }
    }
};

WVL.clickOnTrack = function (e, track) {
    console.log("click on track e: " + e);
    console.log("name: " + track.name);
    console.log("trail: " + track.trail);
    console.log("latLng: " + e.latlng);
    if (track != WVL.currentTrack)
        WVL.setCurrentTrack(track);
    var de = e.originalEvent;
    console.log("shift: " + de.shiftKey);
    var pt = [e.latlng.lat, e.latlng.lng];
    console.log("pt: " + pt);
    var ret = WVL.findNearestPoint(pt, track.latLng);
    console.log("ret: " + JSON.stringify(ret));
    if (!ret) return;
    var i = ret.i;
    var trec = track.recs[i];
    console.log("trec: " + JSON.stringify(trec));
    if (!trec) return;
    var rt = trec.rt;
    console.log("****** seek to " + rt);
    if (WVL.display) {
        WVL.display.setPlayTime(rt);
    }
    //WVL.setPlayTime(trec.rt);
    var latLng = [trec.pos[0], trec.pos[1]];
    WVL.setPoint(latLng);
    WVL.trackWatchers.forEach(w => {
        w(track, trec, e);
    });
};

WVL.clickOnPlacemark = function (e, trackDesc, gpos) {
    WVL.map.setView(new L.LatLng(gpos[0], gpos[1]), 18, { animate: true });
};

var E;
WVL.LOCK = true;
WVL.dragPlacemark = function (e, trackDesc, gpos) {
    console.log("dragging placemark gpos: " + gpos);
    var placemark = trackDesc.placemark;
    E = e;
    if (!WVL.LOCK) {
        var t1 = WVL.getClockTime();
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
        WVL.updateTrack(trackDesc.data);
        var t2 = WVL.getClockTime();
        console.log("updated in " + (t2 - t1) + " secs");
    }
};

//WVL.setPoint = function(trec)
WVL.setPoint = function (latLng) {
    if (!WVL.cursor) WVL.cursor = L.marker(latLng);
    WVL.cursor.setLatLng(latLng);
};

WVL.addLayerControl = function () {
    //var group1 = L.layerGroup([littleton, denver, aurora, golden]);
    //    var overlayMaps = {
    //	"Trails": WVL.trackLayer,
    //    };
    //L.control.layers(null, WVL.layers).addTo(WVL.map);
    var maps = {
        'OpenStreetMap': WVL.osm,
        'Google Sattelite': WVL.googleSat
    };
    WVL.layerControl = L.control.layers(maps, WVL.layers).addTo(WVL.map);
};

WVL.LeafletVideoApp = class {
    constructor() {
        // for debugging, pick lat lon we are familiar with
        // that shows some video trails
        var lat = 36.98284;
        var lon = -122.06107;
        //var pano = new PanoProxy(display);
        var latlon = { lat, lng: lon };
        WVL.initmap(latlon);
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
        WVL.display = this.display;
        await this.display.playerReady();
    }

    async loadTours(toursURL) {
        return WVL.loadTracksFromFile(toursURL);
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
        WVL.setPlayTime(t);
    }

}

WVL.initmap = function (latlng, bounds) {
    // set up the map
    var map = new L.Map('map');
    WVL.map = map;
    WVL.trackLayer = L.layerGroup();
    WVL.layers['Trails'] = WVL.trackLayer;
    WVL.trackLayer.addTo(map);
    WVL.homeLatLng = latlng;
    WVL.homeBounds = bounds;
    map.on('click', WVL.clickOnMap);

    // create the tile layer with correct attribution
    var osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    var osmAttrib = 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
    //var osm = new L.TileLayer(osmUrl, {minZoom: 17, maxZoom: 19, attribution: osmAttrib});
    var osm = new L.TileLayer(osmUrl, { minZoom: 5, maxZoom: 21, attribution: osmAttrib });
    WVL.osm = osm;
    // Google areal imagery layer
    WVL.googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });
    // start the map in South-East England
    //map.setView(new L.LatLng(latlng.lat, latlng.lng),18);
    map.setView(new L.LatLng(latlng.lat, latlng.lng), 10);
    map.addLayer(osm);
    //map.addLayer(googleSat);

    //L.easyButton('fa-globe fa-fixed fa-lg', function (btn, map) {
    //    WVL.setViewHome();
    //}).addTo(map);

    WVL.cursor = L.marker([0, 0]);
    WVL.cursor.addTo(map);
    WVL.setPlayTime(0);
    setTimeout(WVL.timerFun, 500);
    WVL.addLayerControl();
};

//
var TD;
WVL.handleTrack = function (trackDesc, trackData, url, map) {
    var name = trackData.name;
    name = trackDesc.id; //********* Not sure if this is safe!!!
    console.log("handleTrack id:", trackDesc.id, " name:", name);
    trackData.desc = trackDesc; //*** NOTE: these set up a circular reference
    trackDesc.data = trackData;
    WVL.tracks[name] = trackData;
    //console.log("handleTrailData " + url);
    WVL.computeTrackPoints(trackData);
    trackData.trail = L.polyline(trackData.latLng, { color: '#3333ff', weight: 6 });
    trackData.trail.on('click', function (e) {
        WVL.clickOnTrack(e, trackData);
    });
    //trackData.trail.addTo(map);
    var trackLayerName = trackDesc.layerName;
    if (!trackLayerName) trackLayerName = "Trails";
    var trackLayer = WVL.layers[trackLayerName];
    if (!trackLayer) {
        console.log("*** adding trackLayer", trackLayerName);
        trackLayer = L.layerGroup();
        WVL.layers[trackLayerName] = trackLayer;
        //L.control.layers(null, WVL.layers).addTo(WVL.map);
        if (WVL.layerControl) WVL.layerControl.addOverlay(trackLayer, trackLayerName);
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
        WVL.clickOnPlacemark(e, trackDesc, gpos);
    });
    trackDesc.placemark.on('drag dragend', e => {
        WVL.dragPlacemark(e, trackDesc, gpos);
    });
};

WVL.updateTrack = function (trackData) {
    console.log("updateTrack");
    WVL.computeTrackPoints(trackData);
    var desc = trackData.desc;
    trackData.trail.setLatLngs(trackData.latLng);
};

WVL.computeTrackPoints = function (trackData) {
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
};

WVL.loadTrackFromAPI = function (trackDesc, map) {
    //var url = "/api/v1/track/"+idmempark_Mar_23_2017_11_25_28_AM_2017-03-23_11-25-28";
    var trackId = trackDesc.id;
    var url = "/api/v1/track/" + trackId;
    WV.getJSON(url, function (data) {
        //console.log("GOT JSON: "+data);
        WVL.handleTrack(trackDesc, data, url, map);
    });
};



WVL.loadTrackFromFile = async function (trackDesc, url, map) {
    var data = await WV.loadJSON(url);
    WVL.handleTrack(trackDesc, data, url, map);
    return data;
};

WVL.handleSIOMessage = function (msg) {
    console.log("WVL received position msg: " + JSON.stringify(msg));
    var clientId = msg.clientId;
    var marker = WVL.clientMarkers[clientId];
    var lat = msg.position[0];
    var lng = msg.position[1];
    if (marker) {
        console.log("AdjustMarker " + clientId);
        //clientMarkers[clientId].setLatLng(L.latLng(lat,lng));
        marker.setLatLng([lat, lng]);
    } else {
        console.log("CreateMarker " + clientId);
        var marker = L.marker([lat, lng]).addTo(WVL.map);
        WVL.clientMarkers[clientId] = marker;
    }
};

WVL.watchPositions = function () {
    console.log("************** watch Positions *************");
    WVL.sock = io(WVL.SIO_URL);
    WVL.sock.on('position', WVL.handleSIOMessage);
};

WVL.match = function (s1, s2) {
    return s1.toLowerCase() == s2.toLowerCase();
};

WVL.handleLayerRecs = async function (tours, url, map) {
    console.log("got tours data from " + url);
    for (var i = 0; i < tours.records.length; i++) {
        //tours.records.forEach(async trackDesc => {
        var trackDesc = tours.records[i];
        if (WVL.match(trackDesc.recType, "IndoorMap")) {
            console.log("**** indoor map ", trackDesc);
            var imap = trackDesc;
            var p1 = imap.p0;
            var p2 = [p1[0] + .001, p1[1]];
            var p3 = [p1[0], p1[1] + 0.001];
            var imlayer = new WVL.ImageLayer(imap.imageUrl, {
                p1: p1,
                width: imap.width,
                height: imap.height,
                heading: imap.heading
            });
            //	    var imlayer = new WVL.ImageLayer(imap.imageUrl, {p1: p1, p2: p2, p3: p3});
            WVL.indoorMaps[imap.id] = imlayer;
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
        WVL.trackDescs[trackId] = trackDesc;
        console.log("skipping loading of", trackDesc.id);
        //var trackData = await WVL.loadTrackFromFile(trackDesc, dataUrl, map);
        //console.log("got", trackData);
    }
    //await WVL.loadAllTracksData(map);
};


// This goes through all loaded trackDescs and reads their data files.
WVL.loadAllTracksData = async function (map) {
    console.log("loadAllTracksData");
    for (var id in WVL.trackDescs) {
        console.log("loadTracksData id", id);
        var trackDesc = WVL.trackDescs[id];
        var dataUrl = trackDesc.dataUrl;
        await WVL.loadTrackFromFile(trackDesc, dataUrl, map);
    }
}

// this loads the top level tours file that has all the tours
// coordinate systems, indoor maps, etc.   It does not contain
// the path data for each tour.  Those are stored in separate
// JSON files
WVL.loadTracksFromFile = async function (url, map) {
    console.log("**** WVL.loadTracksFromFile " + url);
    if (!map) map = WVL.map;
    var data = await WV.loadJSON(url);

    // This will process all the records, and load the track descriptors
    // into WVL.trackDescs for each track, but not load the path data.
    await WVL.handleLayerRecs(data, url, map);
    //
    // This will actually load the paths data.
    var lazy = true;
    if (lazy) {
        WVL.loadAllTracksData(map);
    }
    else {
        await WVL.loadAllTracksData(map);
    }
    console.log("all tracks loaded");
    return data;
};

/*
  Linear search to find index i such that

  recs[i-1].rt <= rt   &&   rt <= recs[i]

  if rt < recs[0]                 returns i=0
  if rt < recs[recs.length-1].rt  returns recs.length
*/
WVL.linSearch = function (recs, rt) {
    for (var i = 0; i < recs.length; i++) {
        if (recs[i].rt > rt) return i;
    }
    return i;
};

/*
  Binary search.  Same contract as Linear search
  but should be faster.
 */
WVL.binSearch = function (recs, rt) {
    var iMin = 0;
    var iMax = recs.length - 1;

    while (iMin < iMax) {
        var i = Math.floor((iMin + iMax) / 2.0);
        var rec = recs[i];
        if (rec.rt == rt) return i + 1;
        if (rt > rec.rt) {
            iMin = i;
        } else {
            iMax = i;
        }
        if (iMin >= iMax - 1) break;
    }
    return iMin + 1;
};

WVL.testSearchFun1 = function (recs, searchFun) {
    function correctPos(rt, recs, i) {
        //console.log("rt: "+rt+" i: "+i);
        if (i == 0) {
            if (rt <= recs[0].rt) return true;
            return false;
        }
        if (rt > recs[recs.length - 1].rt && i == recs.length) return true;
        if (recs[i - 1].rt <= rt && rt <= recs[i].rt) return true;
        return false;
    }

    //for (var i=0; i<recs.length; i++) {
    //  console.log(i+" "+recs[i].rt);
    //}
    var errs = 0;
    for (var i = 0; i < recs.length - 1; i++) {
        var rt = recs[i].rt;
        var ii = searchFun(recs, rt);
        if (!correctPos(rt, recs, ii)) {
            console.log("error:  rt " + rt + "  -->  " + ii);
            errs++;
        }
        rt = (recs[i].rt + recs[i + 1].rt) / 2.0;
        ii = searchFun(recs, rt);
        if (!correctPos(rt, recs, ii)) {
            console.log("error:  rt " + rt + "  -->  " + ii);
            errs++;
        }
    }
    return errs;
};

WVL.testSearch = function (nrecs) {
    nrecs = nrecs | 100000;
    console.log("WVL.testSearch " + nrecs);
    recs = [];
    for (var i = 0; i < nrecs; i++) {
        recs.push({ i: i, rt: Math.random() * 100000000 });
        //recs.push( {i: i, rt: Math.random()*10000 });
    }
    recs.sort(function (a, b) {
        return a.rt - b.rt;
    });
    for (var i = 0; i < nrecs - 1; i++) {
        if (recs[i].rt >= recs[i + 1].rt) {
            console.log("**** testSearch: recs not sorted ****");
            return;
        }
        if (recs[i].rt == recs[i + 1].rt) {
            console.log("**** testSearch: recs not unique ****");
            return;
        }
    }
    console.log("Testing Linear Search");
    var t1 = WVL.getClockTime();
    var errs = WVL.testSearchFun1(recs, WVL.linSearch);
    var t2 = WVL.getClockTime();
    console.log("lin searched " + nrecs + " times in " + (t2 - t1) + " secs " + errs + " errors");
    console.log("Testing binary Search");
    var t1 = WVL.getClockTime();
    var errs = WVL.testSearchFun1(recs, WVL.binSearch);
    var t2 = WVL.getClockTime();
    console.log("bin searched " + nrecs + " times in " + (t2 - t1) + " secs " + errs + " errors");
};

WVL.findPointByTime = function (track, rt) {
    //console.log("WVL.findPointByTime "+rt);
    //i = WVL.linSearch(rec.data.recs, rt);
    var recs = track.recs;
    var points = track.latLng;
    var i = WVL.binSearch(recs, rt);
    if (i == 0) {
        return { i: i, f: 0, nearestPt: points[i] };
    }
    if (i >= points.length) {
        i = points.length - 1;
        return { i: i, f: 1, nearestPt: points[i] };
    }
    var i0 = i - 1;
    var rt0 = recs[i0].rt;
    var rt01 = recs[i].rt - rt0;
    var f = (rt - rt0) / rt01;
    //console.log("i0: "+i0+" i: "+i+"  f: "+f);
    var p0 = points[i0];
    var p1 = points[i];
    //Cesium.Cartesian3.lerp(rec.points[i0], rec.points[i], f, pt);
    var pt = WVL.lerp(points[i0], points[i], f, pt);
    return { i: i, f: f, nearestPt: pt };
};

WVL.findNearestPoint = function (pt, points) {
    console.log("findNearestPoint: pt: " + pt + " npoints: " + points.length);
    if (points.length == 0) {
        console.log("findNearestPoint called with no points");
        null;
    }
    var d2Min = WVL.distanceSquared(pt, points[0]);
    var iMin = 0;
    for (var i = 1; i < points.length; i++) {
        var d2 = WVL.distanceSquared(pt, points[i]);
        if (d2 < d2Min) {
            d2Min = d2;
            iMin = i;
        }
    }
    return { 'i': iMin, nearestPt: points[iMin], 'd': Math.sqrt(d2Min) };
};


