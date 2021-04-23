/*
Some WorldViews utility functions.  Use WV as a namespace.
*/

if (typeof WV == "undefined") {
    WV = {};
}

// Get a named parameter from the URL query string, or return
// provided default value if the parameter isn't specified.
WV.getParameterByName = function (name, defaultVal) {
    //console.log("getParameterByName", name, defaultVal);
    if (typeof window === 'undefined') {
        console.log("***** getParameterByName called outside of browser...");
        return defaultVal;
    }
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    val = match && decodeURIComponent(match[1].replace(/\+/g, ' '));
    //console.log("val:", val);
    if (!val)
        return defaultVal;
    return val;
}

// Return a float valued parameter, or default value if parameter is missing
WV.getFloatParameterByName = function (name, defaultVal) {
    var val = getParameterByName(name, defaultVal);
    if (val != null)
        return parseFloat(val);
    return val;
}

// Return a boolean valued parameter.  It may be specified using
// 0 or false or null to indicate FALSE.   Case insensitive.
WV.getBooleanParameterByName = function (name, defaultVal) {
    var val = getParameterByName(name, defaultVal);
    if (typeof val == "string") {
        console.log("getBool", val);
        sval = val.toLowerCase()
        if (sval == "0" || sval == "false" || sval == "null")
            return false;
        return true;
    }
    return val;
}

// return current clock time in seconds
WV.getClockTime = function() {
	return new Date() / 1000.0;
}

// Error reporting, this prints error in console, and shows
// the first error as an alert.  Useful for debugging.
WV.errsShown = {};
WV.error = function(str) {
	console.log(str);
	if (!WV.errsShown[str]) {
		WV.errsShown[str] = 1;
		alert(str);
	}
}

// convert degrees to radians
WV.toRadians = function(d) {
	return Math.PI * d / 180;
}

// convert radians to degrees
WV.toDegrees = function(r) {
	return 180 * r / Math.PI;
}

/*
  Use this instead of $.getJSON() because this will give
  an error message in the console if there is a parse error
  in the JSON.
 */
WV.getJSON = function (url, handler, errFun) {
	console.log(">>>>> getJSON: " + url);
	$.ajax({
		url: url,
		dataType: 'text',
		success: function (str) {
			try {
				data = JSON.parse(str);
				//data = eval(str);
				handler(data);
			}
			catch (e) {
				console.log("*** error: " + e);
				alert("JSON error: " + e);
			}
		},
		error: function (e) {
			console.log("WV.getJSON error " + e);
			if (errFun)
				errFun(e);
		}
	});
}

// This is a promise based version of code for getting
// JSON.  New code should use this instead of getJSON
// and older code should migrate to this.
WV.loadJSON = async function(url) {
    console.log("loadJSON: " + url);
    return new Promise((res, rej) => {
        $.ajax({
            url: url,
            dataType: 'text',
            success: function (str) {
                var data;
                try {
                    data = JSON.parse(str);
                }
                catch (err) {
                    console.log("err: " + err);
                    alert("Error in json for: " + url + "\n" + err);
                    rej(err);
                }
                res(data);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log("Failed to get JSON for " + url);
                rej(errorThrown);
            }
        });
    })
}

/***************************************************************************************************/
// This section contains various utilities for dealing with geomtry and paths
//
WV.distanceSquared = function (pt1, pt2) {
    var dx = pt1[0] - pt2[0];
    var dy = pt1[1] - pt2[1];
    var d2 = dx * dx + dy * dy;
    //console.log("dsq "+pt1+" "+pt2+"   d2: "+d2);
    return d2;
};

// linear interp... 
WV.lerp = function (pt1, pt2, f, pt) {
    var x = (1 - f) * pt1[0] + f * pt2[0];
    var y = (1 - f) * pt1[1] + f * pt2[1];
    return [x, y];
};

/*
  Linear search to find index i such that

  recs[i-1].rt <= rt   &&   rt <= recs[i]

  if rt < recs[0]                 returns i=0
  if rt < recs[recs.length-1].rt  returns recs.length
*/
WV.linSearch = function (recs, rt) {
    for (var i = 0; i < recs.length; i++) {
        if (recs[i].rt > rt) return i;
    }
    return i;
};

/*
  Binary search.  Same contract as Linear search
  but should be faster.
 */
WV.binSearch = function (recs, rt) {
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

WV.testSearchFun1 = function (recs, searchFun) {
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

WV.testSearch = function (nrecs) {
    nrecs = nrecs | 50000;
    console.log("WV.testSearch " + nrecs);
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
    var t1 = WV.getClockTime();
    var errs = WV.testSearchFun1(recs, WV.linSearch);
    var t2 = WV.getClockTime();
    console.log("lin searched " + nrecs + " times in " + (t2 - t1) + " secs " + errs + " errors");
    console.log("Testing binary Search");
    var t1 = WV.getClockTime();
    var errs = WV.testSearchFun1(recs, WV.binSearch);
    var t2 = WV.getClockTime();
    console.log("bin searched " + nrecs + " times in " + (t2 - t1) + " secs " + errs + " errors");
};

WV.findPointByTime = function (track, rt) {
    //console.log("WV.findPointByTime "+rt);
    //i = WV.linSearch(rec.data.recs, rt);
    var recs = track.recs;
    var points = track.latLng;
    var i = WV.binSearch(recs, rt);
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
    var pt = WV.lerp(points[i0], points[i], f, pt);
    return { i: i, f: f, nearestPt: pt };
};

WV.findNearestPoint = function (pt, points) {
    console.log("findNearestPoint: pt: " + pt + " npoints: " + points.length);
    if (points.length == 0) {
        console.log("findNearestPoint called with no points");
        null;
    }
    var d2Min = WV.distanceSquared(pt, points[0]);
    var iMin = 0;
    for (var i = 1; i < points.length; i++) {
        var d2 = WV.distanceSquared(pt, points[i]);
        if (d2 < d2Min) {
            d2Min = d2;
            iMin = i;
        }
    }
    return { 'i': iMin, nearestPt: points[iMin], 'd': Math.sqrt(d2Min) };
};
