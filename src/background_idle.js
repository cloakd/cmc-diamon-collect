let scraping = false
let tab = null
let activeRequest = null
let scraper = null

chrome.webRequest.onBeforeRequest.addListener(
	function (details) {
		if (details.type === "image" || details.url === "https://api-mainnet.magiceden.io/all_collections_with_escrow_data?edge_cache=true") {
			return {cancel: true}
		}

		if (details.url.indexOf("buy_now") === -1 || details.method !== "GET") {
			return {} //Continue
		}

		let uri;
		if (activeRequest) {
			console.log("Active Request:", activeRequest)
			const u = new URL(details.url)
			let params = new URLSearchParams(u.search.substring(1))
			for (const p of params) {
				const key = p[0]
				if (activeRequest[key])
					params.set(p[0], activeRequest[key])
			}
			uri = details.url.split("?")[0] + `?` + params.toString()
		} else {
			uri = details.url.replace("2wci94quHBAAVt1HC4T5SUerZR7699LMb8Ueh3CSVpTX", buyerAddress)
		}

		return {redirectUrl: uri}
	},
	{urls: ["https://*.magiceden.io/*"]}, ["blocking"]
);

//Stops some trash on ME from loading to speed it up on page load
chrome.webRequest.onBeforeRequest.addListener(
	function (details) {
		if (details.type === "image") {
			return {cancel: true}
		}
		return {}
	},
	{urls: ["https://nftstorage.link/*", "https://img-cdn.magiceden.dev/*", "https://*.arweave.net/*"]}, ["blocking"]
);

function init() {
	setInterval(checkForRequest, 200)
	createBaseTab()
}

init()

async function checkForRequest() {
	if (scraping)
		return

	try {
		fetch("http://localhost:8090/requests").catch(e => {
			//
		}).then(onRequestData)
	} catch (e) {
		//
	}
}

async function onRequestData(r) {
	if (scraping || !r)
		return

	const data = await r.json()
	// console.log("Data", data)

	for (let i = 0; i < data.requests.length; i++) {
		const req = data.requests[i]
		activeRequest = req.meta
		console.log("New Scraper Request:", req)
		scraper = new Scraper(req.id, req.meta.tokenMint)
		try {
			scraper.scrape()
		} catch (e) {
			console.error(`Unable to scrape ${req.meta.tokenMint}`, e)
		}
	}
}


function createBaseTab() {
	chrome.tabs.create({
		active: true,
		url: `https://magiceden.io/item-details/3kSKWCMYZTCEBHTjTh1rNrNbXY7jE9dv4uTVQESMNV2X`, //AB Land (worst case we buy it)
	}, (tab) => {
		console.log("Using new tab", tab)
		this.onCreate(tab)
	})
}


function onCreate(tab) {
	this.tab = tab
	console.log("Tab created", tab)
	chrome.debugger.attach({ //debug at current tab
		tabId: this.tab.id
	}, "1.0", () => this.onAttach());
}


function onAttach() {
	console.log("Tab attached", this.tab)

	chrome.debugger.sendCommand({ //first enable the Network
		tabId: this.tab.id
	}, "Network.enable");

	chrome.debugger.onEvent.addListener((d, m, p) => {
		this.allEventHandler(d, m, p)
	});
}


function allEventHandler(debuggeeId, message, params) {
	if (message !== "Network.responseReceived" || params.type !== "XHR") {
		return;
	}

	if (params.response.url.indexOf("buy_now") === -1)
		return;

	//response return
	console.log(debuggeeId, {
		msg: message,
		params: params
	})

	chrome.debugger.sendCommand({
		tabId: debuggeeId.tabId
	}, "Network.getResponseBody", {
		"requestId": params.requestId
	}, (response) => {
		if (!scraper)
			return

		scraper.onTxnFound(response)
	});
}


function closePhantom() {
	console.log("Closing phantom wallets")
	chrome.tabs.query({
		title: "Phantom Wallet",
	}, (tabs) => {
		for (let i = 0; i < tabs.length; i++) {
			console.log("Closing phantom:", tabs[i].windowId)
			chrome.windows.remove(tabs[i].windowId)
		}
	})
}

class Scraper {

	tab
	requestID = ""
	tokenAddr = ""

	constructor(tab, requestID, tokenAddr) {
		this.tab = tab
		this.requestID = requestID
		this.tokenAddr = tokenAddr
		console.log("Scraping: ", tokenAddr)
		setTimeout(() => this.onTimeout(), 10000)
	}

	scrape() {
		scraping = true
		this.sendClickCommand()
	}

	sendClickCommand() {
		chrome.tabs.sendMessage(this.tab.id, {trigger_buy_now: true}, () => {
			//
		});
	}

	onTxnFound(data) {
		console.log("TXN Found: ", data)

		setTimeout(closePhantom, 1000)
		this.sendResponse(data)

		closePhantom()
		this.closeTab()
	}

	onTimeout() {
		this.reset()
	}

	reset() {
		this.clearIsScraping()
		this.closeTab()
	}

	clearIsScraping() {
		setTimeout(() => {
			scraping = false
			activeRequest = null
		}, 400) //Delay for 1 block
	}

	closeTab() {
		try {
			chrome.debugger.detach({tabId: this.tab.id});
			chrome.tabs.remove(this.tab.id)
		} catch (e) {
			//
		}
	}

	sendResponse(data) {
		if (!data) {
			console.log("sendResponse: No data received")
			this.reset()
			return //Error
		}

		// console.log("sendResponse", data)

		const js = JSON.parse(data.body)
		console.log("sendResponse:2", js)

		fetch("http://localhost:8090/response", {
			method: "POST",
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				id: this.requestID,
				data: js.txSigned
			})
		}).catch(e => {
			//
		}).finally(() => {
			this.clearIsScraping()
		})
	}

}