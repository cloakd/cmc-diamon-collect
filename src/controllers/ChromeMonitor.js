class ChromeMonitor {


	constructor() {
		chrome.runtime.onMessage.addListener(this.onMessage)
		chrome.webRequest.onBeforeRequest.addListener(this.onBeforeRequest, {urls: ["https://*.magiceden.io/*"]}, ["blocking"])
		chrome.webRequest.onBeforeRequest.addListener(this.onBeforeRequestMediaBlock, {urls: ["https://nftstorage.link/*", "https://img-cdn.magiceden.dev/*", "https://*.arweave.net/*", "https://*.ipfs.nftstorage.link/*"]}, ["blocking"])

		//Listen on returning message
		chrome.debugger.onEvent.addListener(this.onEvent)
	}

	onEvent(debuggeeId, message, params) {
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
			onTxnFound(response) //TODO
		});
	}

	onMessage(request, sender, sendResponse) {
		if (request.failed) {
			console.log("Failed to get TXN Data")
			chrome.tabs.remove(sender.tab.id)
		}
		sendResponse()
	}


	onBeforeRequestMediaBlock(details) {
		if (details.initiator !== "https://magiceden.io")
			return {}

		if (details.type === "image") {
			return {cancel: true}
		}
		console.log(details.url, details)
		return {}
	}

	onBeforeRequest(details) {
		if (details.type === "image" || details.url === "https://api-mainnet.magiceden.io/all_collections_with_escrow_data?edge_cache=true") {
			return {cancel: true}
		}

		if (details.url.indexOf("buy_now") === -1 || details.method !== "GET") {
			return {} //Continue
		}

		let uri;
		if (this.activeRequest) {
			console.log("Active Request:", this.activeRequest)
			const u = new URL(details.url)
			let params = new URLSearchParams(u.search.substring(1))
			for (const p of params) {
				const key = p[0]
				if (this.activeRequest[key])
					params.set(p[0], this.activeRequest[key])
			}
			let newUri = details.url.split("?")[0] + `?` + params.toString()
			uri = newUri

			console.log("URI Update", {
				old: new URL(details.url),
				updated: new URL(newUri)
			})
		} else {
			uri = details.url.replace("2wci94quHBAAVt1HC4T5SUerZR7699LMb8Ueh3CSVpTX", buyerAddress)
		}

		return {redirectUrl: uri}
	}

	closePhantom() {
		console.log("Closing phantom wallets")
		chrome.tabs.query({
			title: "Phantom Wallet",
			discarded: false,
		}, (tabs) => {
			for (let i = 0; i < tabs.length; i++) {
				console.log("Closing phantom:", tabs[i].windowId)
				chrome.windows.remove(tabs[i].windowId)
			}
		})
	}

}