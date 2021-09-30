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
        var res = text.match(re);
        console.log(res[0]);

        if (text.indexOf("collect")) {
            // var split = tm[0].split(":");
            var split = res[0].split(":");

            // var tm = text.split(" ");
            console.log("Split", split);

            var total = (split[0] * 3600) + (split[1] * 60) + (split[2] * 1);
            console.log("asd", {
                1: split[0],
                2: split[1],
                3: split[2]
            });
            console.log('Total Seconds: ', total);

            var redeemAt = Date.now() + (total * 1000);

            chrome.storage.sync.set({"cmc.diamond.timeout": redeemAt});
            return;
        }
        //TODO
    }
})();