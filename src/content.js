(function () {
	"use strict";

	let arkoseActive = false

	//Detect Arkose
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


	//Listen for background messages
	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		console.log("content::onMessageListener", request)
		onBackgroundMessage(request)
		sendResponse()
		return true
	});

	//Handle background messages
	function onBackgroundMessage(request) {
		console.log("CS From BG: ", request)
		switch (request.type) {
			case "buy_now":
				checkRoyaltySetting()
				clickBuyButton()
				break
			case "buy_quick": //TODO Quick buy first item on collection page
				checkRoyaltySetting()
				clickBuyQuickButton()
				break
			case "sell_pool": //TODO Quick buy first item on collection page
				checkRoyaltySetting()
				clickSellPoolButton()
				break
			case "logout":
				clickSignOutButton()
				reset()
				break
			case "login":
				//Sign out of any old account
				clickSignOutButton()

				setTimeout(() => {
					//Configure wallet details
					if (request.data.is_bulk)
						configureWallet(request.data.requests[0].meta.buyer)
					else
						configureWallet(request.data.meta.buyer)

					//Click connect
					clickConnectWalletButton() //TODO We may not need this if connect always triggers msg sign
					setTimeout(() => clickPhantomWalletButton(), 600) //Handle connecting to phantom

					//Click sign in & then sign message once it pops up
					setTimeout(() => {
						// clickSignInButton()
						setTimeout(() => clickSignMessageButton(), 1000)
					}, 800)
				}, 800)


				break
		}
	}


	//Trigger arkose solver flow
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
				img = imgs[i]
				break
			}
		}
		return img
	}


	function _repeatAttempt(attempts = 0, callback) {
		if (arkoseActive) {
			console.warn("_repeatAttempt Arkose active, stopping attempts")
			return; //Arkose challenge active
		}

		if (attempts > 5) {
			onFailed("Unable to find button")
			return;
		}

		attempts++
		console.warn("_repeatAttempt Attempt: ", attempts)
		if (!callback())
			setTimeout(() => _repeatAttempt(attempts, callback), 400)
	}

	function clickSignOutButton() {
		if (arkoseActive) {
			console.warn("Arkose active, skipping sign out")
			return
		}

		let btn = _findSpan("sign out")
		console.log("Sign out button", btn)
		if (btn !== null) {
			console.log("Clicking Sign out")
			btn.click()
		}

		// localStorage.clear()
		configureWalletEnvironment()
	}

	function clickConnectWalletButton() {
		_repeatAttempt(0, () => {
			let btn = _findButton("connect wallet")
			if (!btn) {
				console.log("clickConnectWalletButton - Cant find Connect Waller")
				return false
			}

			console.log("Clicking connect wallet")
			btn.click()
			return true
		})
	}

	function clickSignInButton() {
		_repeatAttempt(0, () => {
			let btn = _findButton("sign in")
			if (!btn) {
				console.log("clickSignInButton - Cant find Sign In")
				return false
			}

			console.log("Clicking Sign In", btn)
			btn.click()
			return true
		})
	}

	function clickSignMessageButton() {
		_repeatAttempt(0, () => {
			let btn = _findButton("verify wallet")
			if (!btn) {
				console.log("clickSignMessageButton - Cant find Verify Wallet")
				return false
			}

			console.log("Clicking Sign Message", btn)
			btn.click()
			return true
		})
	}

	function clickPhantomWalletButton() {
		_repeatAttempt(0, () => {
			let btn = _findImage("Phantom icon", 32, 32)
			if (!btn) {
				console.log("clickPhantomWalletButton - Cant find Phantom Icon")
				return false
			}

			console.log("Clicking Phantom Wallet button")
			btn.click()
			return true
		})
	}

	function clickBuyQuickButton() {
		_repeatAttempt(0, () => {
			const btn = _findButton("Quick buy")
			if (!btn) return false

			console.log("Clicking Buy Quick Button")
			btn.click()
			return true
		})
	}

	function clickSellPoolButton() {
		_repeatAttempt(0, () => {
			const btn = _findButton("Sell now")
			if (!btn) return false

			console.log("Clicking Sell Pool Button")
			btn.click()
			return true
		})
	}

	function clickBuyButton(attempts = 0) {
		_repeatAttempt(0, () => {
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
					onFailed("Item Unavailable")
					return true; //Break out
				}

				if (attempts > 6) {
					onFailed("Unable to click buy")
					return true; //Break out
				}
			}

			if (btn === null) {
				console.log("Unable to find buy button")
				return false
			} else {
				console.log("Clicking button")
				btn.click()
				return true
			}
		})
	}

	function onFailed(msg = "") {
		console.error("onFailed", msg)
		reset()
		window.location.reload()
		// chrome.runtime.sendMessage({failed: true});
	}

	function reset() {
		localStorage.clear()
		// window.location.reload()
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
	console.log("Configuring wallet", walletAddr)

	window.postMessage({type: "change_wallet", payload: walletAddr})
	// window.phantom.solana.changeAccountTo(walletAddr)
}

function configureWalletEnvironment() {
	console.log("Configuring wallet environment")
	localStorage.removeItem("sa")
	localStorage.removeItem("pwu")
	localStorage.removeItem("user-token")
	localStorage.removeItem("user-tokens")
	localStorage.removeItem("browser_session_token")
	localStorage.removeItem("browser_verification_details")
	localStorage.removeItem("profile-local-cache")

	localStorage.setItem("walletName", `"Phantom"`)
	localStorage.setItem("last-connected-wallet", `"Phantom"`)
	localStorage.setItem("blockchain-preference", `"solana"`)
	localStorage.setItem("royaltyPercentage", JSON.stringify({value: 0, label: "None"}))
}

configureWalletEnvironment()

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