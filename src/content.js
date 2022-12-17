(function () {
	"use strict";

	let arkoseActive = false

	setInterval(() => {
		const iframes = document.getElementsByTagName("iframe")
		for (let iframe of iframes) {
			if (iframe.src.indexOf("arkose") === -1)
				continue

			if (iframe.style.width === "100vw" && !arkoseActive) {
				console.log("Arkose challenge detected")
				arkoseActive = true
				onArkoseActive()
				break
			} else if (iframe.style.width === "0px" && arkoseActive) {
				console.log("Arkose challenge finished")
				arkoseActive = false
				break
			}
		}

	}, 1000)




	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		console.log("content::onMessageListener", request)
		onBackgroundMessage(request)
		sendResponse()
		return true
	});

	function onBackgroundMessage(request) {
		console.log("CS From BG: ", request)

		switch (request.type) {
			case "buy_now":
				checkRoyaltySetting()
				clickBuyButton()
				break
			case "login":
				//Sign out of any old account
				clickSignOutButton()

				setTimeout(() => {
					//Configure wallet details
					configureWallet(request.data.meta.buyer)

					//Click connect
					clickConnectWalletButton() //TODO We may not need this if connect always triggers msg sign
					setTimeout(() => clickPhantomWalletButton(), 600) //Handle connecting to phantom

					//Click sign in & then sign message once it pops up
					setTimeout(() => {
						clickSignInButton()
						setTimeout(() => clickSignMessageButton(), 1000)
					}, 800)
				}, 800)


				break
		}
	}

	let attempts = 0;

	function onArkoseActive() {
		chrome.runtime.sendMessage({
			type: "captcha", options: {
				type: "funcaptcha",
			}
		});
	}

	function _findType(tag, text) {
		const btns = document.getElementsByTagName(tag)
		let btn = null
		for (let i = 0; i < btns.length; i++) {
			if (btns[i].innerHTML.toLowerCase() === text.toLowerCase() && !btns[i].disabled) {
				console.log(`${tag} found`, btns[i])
				attempts = 0
				btn = btns[i]
				break
			}
		}
		return btn
	}

	function _findSpan(text) {
		return _findType("span", text)
	}

	function _findButton(text) {
		return _findType("button", text)
	}

	function _findImage(altText, width, height) {
		const imgs = document.getElementsByTagName("img")
		let img = null
		for (let i = 0; i < imgs.length; i++) {
			const alt = imgs[i].getAttribute('alt') || '';
			if (alt.toLowerCase() === altText.toLowerCase() && imgs[i].width === width && imgs[i].height === height) {
				attempts = 0
				img = imgs[i]
				break
			}
		}
		return img
	}

	function clickConnectWalletButton() {
		if (arkoseActive)
			return; //Arkose challenge active

		if (attempts > 20) {
			console.error("Unable to find buy button")
			window.location.reload()
			return;
		}

		attempts++
		let btn = _findButton("connect wallet")

		if (btn !== null) {
			btn.click()
		} else {
			attempts = 0
		}
	}

	function clickSignInButton(attempts = 0) {
		if (arkoseActive)
			return

		if (attempts > 5)
			return null

		let btn = _findButton("sign in")
		if (!btn) {
			attempts++
			setTimeout(() => clickSignInButton(attempts), 200)
			return
		}

		console.log("Clicking Sign In", btn)
		btn.click()
	}

	function clickSignOutButton() {
		if (arkoseActive)
			return

		let btn = _findSpan("sign out")
		console.log("Sign out button", btn)
		if (btn !== null) {
			console.log("Clicking Sign out")
			btn.click()
			localStorage.clear()
		} else {
			attempts = 0
		}
	}

	function clickSignMessageButton() {
		if (arkoseActive)
			return

		if (attempts > 5)
			return null

		let btn = _findButton("sign message")
		if (!btn) {
			attempts++
			setTimeout(() => clickSignInButton(attempts), 200)
			return
		}

		console.log("Clicking Sign Message", btn)
		btn.click()
	}


	function clickPhantomWalletButton() {
		if (arkoseActive)
			return; //Arkose challenge active

		let btn = _findImage("Phantom icon", 28, 28)

		if (btn !== null) {
			btn.click()
		} else {
			attempts = 0
		}
	}

	function clickBuyButton() {
		if (arkoseActive)
			return; //Arkose challenge active

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
			setTimeout(clickBuyButton, 400)
		} else {
			btn.click()
		}
	}

	function onFailed() {
		console.log("onFailed")
		window.location.reload()
		// chrome.runtime.sendMessage({failed: true});
	}

	function shouldClick() {
		if (window.location.pathname.indexOf("item-details") === -1)
			return false

		return new URLSearchParams(window.location.search).get("c") !== "f"
	}

	if (shouldClick())
		clickBuyButton()
})();

function configureWallet(walletAddr) {
	console.log("Configuring wallet")
	configureWalletEnvironment()

	window.postMessage({type: "change_wallet", payload: walletAddr})
	// window.phantom.solana.changeAccountTo(walletAddr)
}

function configureWalletEnvironment() {
	localStorage.setItem("walletName", `"Phantom"`)
	localStorage.setItem("last-connected-wallet", `"Phantom"`)
	localStorage.setItem("blockchain-preference", `"solana"`)
}

function checkRoyaltySetting() {
	let pctData = JSON.parse(localStorage.getItem("royaltyPercentage"))
	if (!pctData || pctData.value === 0)
		return

	console.error("Invalid royalties, resetting", pctData)
	pctData.value = 0
	pctData.label = "None"
	localStorage.setItem("royaltyPercentage", JSON.stringify(pctData))
}

checkRoyaltySetting()

function findButton(text) {
	const btns = document.getElementsByTagName("button")
	for (let i = 0; i < btns.length; i++) {
		if (btns[i].innerHTML.toLowerCase() === text && !btns[i].disabled) {
			return btns[i]
		}
	}
	return null
}

//Inject our fake wallet
function injectScript(file, node) {
	let th = document.getElementsByTagName(node)[0];
	let s = document.createElement('script');
	s.setAttribute('type', 'text/javascript');
	s.setAttribute('src', file);
	th.appendChild(s);
}

injectScript(chrome.extension.getURL('remote_wallet.js'), 'body');


window.addEventListener("message", onMessage)

function onMessage(e) {
	if (e.data.type && e.data.type === "alpha_msg") {
		console.log("Sending", e.data.method, e.data)
		chrome.runtime.sendMessage({
			method: e.data.method,
			data: e.data.payload
		}, onMessageResponse)
	}
}

function onMessageResponse(r) {
	console.log('content:onMessageResponse', r)
	window.postMessage({type: "alpha_msg_resp", method: "signMessage", payload: r})
}