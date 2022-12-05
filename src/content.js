(function () {
	"use strict";


	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			console.log("CS From BG: ", request)
			checkRoyaltySetting()
			clickBuyButton()
			sendResponse()
		}
	);

	let attempts = 0;

	function clickBuyButton() {

		if (attempts > 20) {
			console.error("Unable to find buy button")
			window.location.reload()
			return;
		}

		attempts++
		const btns = document.getElementsByTagName("button")
		let btn = null
		for (let i = 0; i < btns.length; i++) {
			if (attempts > 2 && btns[i].innerHTML.toLowerCase() === "connect wallet") {
				console.log("Connecting wallet")
				btns[i].click()
				continue
			}

			if (btns[i].innerHTML.toLowerCase() === "buy now" && !btns[i].disabled) {
				console.log("Found Button!")
				attempts = 0
				btn = btns[i]
				break
			}

			if (attempts > 5 && btns[i].innerHTML.toLowerCase() === "make an offer") {
				console.log("Item Unavailable")
				onFailed()
				return; //Break out
			}
		}

		if (btn === null) {
			setTimeout(clickBuyButton, 200)
		} else {
			btn.click()
		}
	}

	function onFailed() {
		chrome.runtime.sendMessage({failed: true});
	}

	function shouldClick() {
		return new URLSearchParams(window.location.search).get("c") !== "f"
	}

	if (shouldClick())
		clickBuyButton()
})();

function checkRoyaltySetting() {
	let pctData = JSON.parse(localStorage.getItem("royaltyPercentage"))
	if (pctData.value === 0)
		return

	console.error("Invalid royalties, resetting", pctData)
	pctData.value = 0
	pctData.label = "None"
	localStorage.setItem("royaltyPercentage", JSON.stringify(pctData))
}

checkRoyaltySetting()