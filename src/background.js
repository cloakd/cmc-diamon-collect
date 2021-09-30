function checkDiamondClaim() {
    console.log("Checking claim");
    chrome.storage.sync.get(["cmc.diamond.timeout"], function (data) {

        var left = (data["cmc.diamond.timeout"] - Date.now()) / 1000;
        if (left <= 10) {
            chrome.browserAction.setBadgeText({text: 'CLAIM'});
            chrome.browserAction.setBadgeBackgroundColor({color: 'red'});
        } else
            chrome.browserAction.setBadgeText({text: ''});
    });
}

console.log("Starting CMC Diamond background listner");
checkDiamondClaim();
setInterval(checkDiamondClaim, 10000);