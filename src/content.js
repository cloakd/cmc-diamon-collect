(function () {
    "use strict";

    var re = /[0-5].+:[0-5].+:[0-5]./;

    var buttons = document.getElementsByTagName("button");
    for (var i = 0; i < buttons.length; i++) {
        if (!buttons[i].innerText.toLowerCase().indexOf("diamonds"))
            continue; //Skip
        buttons[i].onclick = handleClaim
    }

    function handleClaim(tab) {
        var text = tab.target.innerHTML;

        if (text === "Collect Diamonds") {

            chrome.storage.sync.set({"cmc.diamond.timeout": setCollectionTimeout("23:59:59")});
            return
        }

        var res = text.match(re);
        if (res.length > 0) {
            console.log("Reg: ",res[0]);
            chrome.storage.sync.set({"cmc.diamond.timeout": setCollectionTimeout(res[0])});
        }
    }

    function setCollectionTimeout(t) {
        var split = t.split(":");
        var total = (split[0] * 3600) + (split[1] * 60) + (split[2] * 1);
        var redeemAt = Date.now() + (total * 1000);
        return redeemAt
    }
})();