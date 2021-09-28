(function () {
    "use strict";

    function checkDiamondClaim() {
        console.log("Checking claim");
        chrome.storage.local.get(["cmc.diamond.timeout"], function (data) {

            var left = (data["cmc.diamond.timeout"] - Date.now()) / 1000;
            console.log("LEFT",left);
            if (left <= 10)
                chrome.browserAction.setBadgeText({text: 'CLAIM'});
        });
    }

    console.log("Starting CMC Diamond background listner");
    setInterval(checkDiamondClaim, 10000)
});