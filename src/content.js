(function () {
    "use strict";

    var buttons = document.getElementsByTagName("button");
    console.log("Button: ", buttons);
    for (var i = 0; i < buttons.length; i++) {
        console.log("Button: ", buttons[i]);

        if (!buttons[i].innerText.toLowerCase().indexOf("diamonds"))
            continue; //Skip

        buttons[i].onclick = handleClaim
    }

    function handleClaim(tab) {
        var text = tab.target.innerHTML;
        if (text.indexOf("collect")) {
            var tm = text.split(" ");

            console.log("Setting timeout", tm);

            var split = tm[0].split(":");

            var total = (split[0]*3600) + (split[1]*60) + (split[2]*1);
            console.log("asd", {
                1: split[0],
                2: split[1],
                3: split[2]
            });
            console.log('Total Seconds: ', total);

            var redeemAt = Date.now() + (total*1000);

            chrome.storage.local.set({"cmc.diamond.timeout": redeemAt});
            chrome.browserAction.setBadgeText({text: ''});
            return;
        }
        //TODO
    }
})();