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

