console.log("Timeout: ", localStorage.getItem("cmc.diamond.timeout"));

var cid = document.getElementById("claim");
var t = document.getElementById("timeout");

cid.addEventListener("click", () => {
    console.log("Going to CMC");

    chrome.windows.create({
        url: "https://coinmarketcap.com/account/my-diamonds/"
    });
});

function loadTimer() {
    chrome.storage.local.get(["cmc.diamond.timeout"], function (data) {
        console.log("timeout loaded", data);

        var left = (data["cmc.diamond.timeout"] - Date.now()) / 1000;

        var h = Math.floor(left / 3600);
        left = left - (h * 3600);

        var m = Math.floor(left / 60);
        left = left - (m * 60);
        var s = Math.round(left);

        t.innerText = h + ":" + m + ":" + s;
    });
}

loadTimer();
setInterval(loadTimer, 1000);