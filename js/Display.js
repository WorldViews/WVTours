

if (typeof WV == "undefined") {
    WV = {};
}

"use strict"

//WV.onYouTubeIframeAPIReady = null;
// We would like to put this in our own namespace, but it is
// a youtube API mechanism we don't have control over.
onYouTubeIframeAPIReady = null;

WV.sleep = async function(secs) {
    return new Promise((res, rej) => {
        setTimeout(() => res(true), secs*1000);
    });
}

WV.Display = class {
    constructor(gtool, parentName, opts) {
        opts = opts || {};
        parentName = parentName || 'gardenPanel';
        //super(opts);
        var inst = this;
        this.name = opts.name;
        this.gtool = gtool;
        this.videoId = opts.videoId || 'FAtdv94yzp4';
        var str = "";
        str += '<div id="mainScreen">\n';
        str += ' <div id="videoDiv">\n'
        str += '   <img id="imageView" src="">\n';
        str += ' </div>\n'
        str += '</div>';
        var div = $(str);
        div.appendTo($('#' + parentName));
        this.playerIsReady = false;
        this.setupYoutubeAPI();
        onYouTubeIframeAPIReady = () => inst.onYouTubeIframeAPIReady();
    }

    async playerReady() {
        console.log("playerReady...");
        return new Promise(async (res, rej) => {
            for (var i=0; i<100 ; i++) {
                if (this.player && this.playerIsReady) {
                    console.log("player is ready");
                    return res(this.player);
                }
                console.log("playerReady sleeping...", i);
                await WV.sleep(0.2);
            }
            return rej("timeout");
        });
    }

    showImage(imgURL) {
        $("#imageView").attr('src', imgURL);
    }

    showYoutubeVideo(imgURL) {
        $("#imageView").attr('src', url);
        //$("#mainScreen").html();

    }

    setupYoutubeAPI() {
        console.log("setupYoutubeAPI");
        var tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    onYouTubeIframeAPIReady() {
        console.log("onYouTubeIframeAPIReady");
        //alert("Its ready!");
        var inst = this;
        //inst.player = new YT.Player('player', {
        //inst.player = new YT.Player('mainScreen', {
        inst.player = new YT.Player('videoDiv', {
            videoId: inst.videoId,
            //height: '750',
            //width: '1000',
            events: {
                'onReady': e => inst.onPlayerReady(e),
                'onStateChange': e => inst.onPlayerStateChange(e)
            }
        });
    }

    // 4. The API will call this function when the video player is ready.
    onPlayerReady(event) {
        console.log("onPlayerReady");
        //alert("player ready!");
        event.target.playVideo();
        console.log("setting playerIsReady true");
        this.playerIsReady = true;
    }

    // 5. The API calls this function when the player's state changes.
    //    The function indicates that when playing a video (state=1),
    //    the player should play for 5 mins and then stop.
    onPlayerStateChange(event) {
        if (event.data == YT.PlayerState.ENDED) {
            this.player.playVideo();
        }
    }

    test() {
        var url = "https://www.youtube.com/watch?v=pZVdQLn_E5w&t=96s";
        this.playVideo()
    }

    setPlayTime(t) {
        if (!this.player) {
            console.log("no player");
            return;
        }
        this.player.seekTo(t);
    }

    getPlayTime() {
        if (!this.player || !this.playerIsReady) {
            return null;
        }
        try {
            return this.player.getCurrentTime();
        }
        catch (e) {
            console.log("error calling player.getCurrentTime - probably YTAPI not ready\n", e);
            return null;
        }
    }
    
    getView() {
        if (!this.player) {
            console.log("no player");
            return null;
        }
        return this.player.getSphericalProperties();
    }
    
    setYaw(yaw) {
        if (!this.player) {
            console.log("no player");
            return;
        }
        this.player.setSphericalProperties({yaw});
    }

    playVideo(idOrURL) {
        if (idOrURL) {
            if (idOrURL.startsWith("http"))
                this.player.loadVideoByUrl(idOrURL);
            else
                this.player.loadVideoById(idOrURL);
        }
        this.player.playVideo();
    }

    stopVideo() {
        this.player.stopVideo();
    }

}


