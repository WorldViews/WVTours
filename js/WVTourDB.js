
"use strict";

class WVTour {
    constructor(rec) {
        for (var key in rec)
            this[key] = rec[key];
    }

    getGeoPath() {
        if (this.trackData)
            return this.trackData.latLng;
        return [];
    }
}

/*
This class is for acessing Tours from a server side DB.  Currently
the DB is in the form of a JSON file describing the collection of tours
and a separate JSON file for each tour, with the path data for that tour.
This allows us to quickly fetch all the placemarks and display them on the
map, and then be loading the tours in the background.
*/
class WVTourDB {
    constructor(client) {
        this.tours = {};    // These are the high level descriptors of a tour
                            // but don't have the path data.
        this.toursUrl = "/data/tours_data.json";
        this.indoorMaps = {};
        this.client = client;
    }

    // this loads the top level tours file that has all the tours
    // coordinate systems, indoor maps, etc.   It does not contain
    // the path data for each tour.  Those are stored in separate
    // JSON files
    async loadTours(url) {
        console.log("**** loadTracksFromFile " + url);
        var toursData = await WV.loadJSON(url);

        // This will process all the tour records, and load the track descriptors
        // into tours for each track, but not load the path data.
        this.handleTours(toursData, url);
        //
        // This will actually load the paths data.
        var lazy = true;
        if (lazy) {
            this.loadAllTracksData();
        }
        else {
            await this.loadAllTracksData();
        }
        console.log("all tracks loaded");
        return toursData;
    }

    // This loads a tours collection.  The records
    // we care about are for coordinate systems, indoor maps,
    // and trails.  Other record types are ignored.
    handleTours(toursData, url) {
        console.log("got tours data from " + url);
        for (var i = 0; i < toursData.records.length; i++) {
            var rec = toursData.records[i];
            if (WV.match(rec.recType, "IndoorMap")) {
                this.handleIndoorMap(rec);
                continue;
            }
            if (rec.recType.toLowerCase() == "coordinatesystem") {
                console.log("coordinateSystem " + JSON.stringify(rec));
                WV.addCoordinateSystem(rec.coordSys, rec);
                continue;
            }
            if (rec.recType != "robotTrail") {
                continue;
            }
            var trackId = rec.id;
            this.tours[trackId] = new WVTour(rec);
        }
    }

    dumpTours() {
        console.log("================")
        console.log("tracks:");
        for (var key in this.tours) {
            console.log("key", key, this.tours[key]);
        }
        console.log("=================");
    }

    handleIndoorMap(rec) {
        console.log("**** indoor map ", rec);
        if (this.client)
            this.client.handleIndoorMap(rec);
    }

    // This goes through all loaded tours and reads their data files.
    async loadAllTracksData() {
        console.log("loadAllTracksData");
        for (var id in this.tours) {
            console.log("loadTracksData id", id);
            var tour = this.tours[id];
            var dataUrl = tour.dataUrl;
            await this.loadTrack(tour, dataUrl);
        }
    }

    // This returns the tour, and ensures that the track data
    // for the tour has been loaded.
    async getTourData(tourName) {
        var tour = this.tours[tourName];
        if (tour == null) {
            console.log("**** Error - no such tour as", tourName);
            return null;
        }
        if (!tour.trackData)
            await this.loadTrack(tour, tour.dataUrl);
        return tour;
    }

    async loadTrack(tour, url) {
        var trackData = await WV.loadJSON(url);
        var name = trackData.name;
        name = tour.id; //********* Not sure if this is safe!!!
        console.log("handleTrack id:", tour.id, " name:", name);
        trackData.desc = tour; //*** NOTE: these set up a circular reference
        tour.trackData = trackData;
        //this.tracks[name] = trackData;
        //console.log("handleTrailData " + url);
        trackData.latLng = this.computeTrackPoints(trackData);
        if (this.client)
            this.client.handleTrack(tour, trackData);
        return trackData;
    }

    // This computes the lat,lon for points on this path.
    computeTrackPoints(trackData) {
        var desc = trackData.desc;
        var recs = trackData.recs;
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
        return latLng;
    }

}

