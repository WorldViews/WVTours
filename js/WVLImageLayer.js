
"use strict";


// This class is used to draw indoor maps onto the Leaflet map.
// We use a class that can handle rotation.
WV.ImageLayer = class {
    constructor(imageUrl, mapApp, opts) {
        this.mapApp = mapApp;
        this.map = mapApp.map;
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
        this.overlay.addTo(this.map);
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

