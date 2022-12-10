class BackgroundRequest {
	buyerAddress = "2PMP31sXqLKmtaR1oSW9pSMPj3aRQPNsyTurrK8Xguhc"

	lastCompletedReqID = ""

	activeRequest = null

	dummyItem = "3xvtrYC12n244QVz8ymr41SNTnwQEpGPg9966BcSRt2c"

	//Tab to use
	tab

	pollTime = 200
	// pollTime = 400

	constructor() {
		chrome.runtime.onMessage.addListener((r,s,cb) => this.onMessage(r,s,cb))
		chrome.webRequest.onBeforeRequest.addListener((d) => this.onBeforeRequest(d), {urls: ["https://*.magiceden.io/*"]}, ["blocking"])
		chrome.webRequest.onBeforeRequest.addListener((d) => this.onBeforeRequestMediaBlock(d), {urls: ["https://nftstorage.link/*", "https://img-cdn.magiceden.dev/*", "https://*.arweave.net/*", "https://*.ipfs.nftstorage.link/*", "https://ipfs.io/*"]}, ["blocking"])

		//Listen on returning message
		chrome.debugger.onEvent.addListener((d,m,p) => this.onEvent(d,m,p))


		//Close phantom regularly
		setInterval(this.closePhantom, 1000)

		//Close any misc tabs
		setInterval(() => {
			this.closeOldTabs()
		}, 20000)

		this.requestMon = new RequestAPI((r) => this.onNewRequest(r))
	}


	onNewRequest(data) {
		const lastReq = data.requests[data.requests.length-1]
		if (lastReq.id === this.lastCompletedReqID)
			return //Already done request

		console.log("New Request: ", lastReq)
		this.activeRequest = lastReq
		this.sendClickCommand()

		setTimeout(() => {
			if (!this.activeRequest || this.activeRequest.id !== lastReq.id)
				return

			this.clearActiveRequest()
		}, 10000)
	}


	onTxnFound(data) {
		console.log("TXN Found: ", data, this.activeRequest)
		if (!this.activeRequest)
			return //No longer useful

		this.lastCompletedReqID = this.activeRequest.id; //Set as last active
		this.requestMon.sendResponse(this.activeRequest.id, data)
		this.clearActiveRequest()
	}

	Run() {
		//Create base tab to use (we use a low value ABTM item as our placeholder item)
		this.createBaseTab()

		//Start polling for requests

		setInterval(() => {
			if (this.isScraping())
				return

			this.requestMon.checkForRequest()
		}, this.pollTime)
	}

	isScraping() {
		return this.activeRequest !== null
	}

	clearActiveRequest() {
		this.activeRequest = null
	}

	async createBaseTab() {
		chrome.tabs.create({
			active: true,
			url: `https://magiceden.io/item-details/${this.dummyItem}?c=f`, //AB Land (worst case we buy it)
		}, (tab) => {
			console.log("Using new tab", tab)
			this._onCreate(tab)
		})
	}

	_onCreate(tab) {
		this.tab = tab
		console.log("Tab created", tab)
		chrome.debugger.attach({ //debug at current tab
			tabId: this.tab.id
		}, "1.0", () => this._onAttach());
	}


	_onAttach() {
		console.log("Tab attached", this.tab)
		chrome.debugger.sendCommand({ //first enable the Network
			tabId: this.tab.id
		}, "Network.enable");
	}

	/**
	 * Intercept response from API & Send to TXNFound if valid
	 * @param debuggeeId
	 * @param message
	 * @param params
	 */
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
			this.onTxnFound(response)
		});
	}

	/**
	 * Handle inbound message from content script
	 * @param request
	 * @param sender
	 * @param sendResponse
	 */
	onMessage(request, sender, sendResponse) {
		if (request.failed) {
			console.log("Failed to get TXN Data")
			window.location.reload()
			// chrome.tabs.remove(sender.tab.id)
		}
		sendResponse()
	}


	/**
	 * Block Media Queries
	 * @param details
	 * @returns {{}|{cancel: boolean}}
	 */
	onBeforeRequestMediaBlock(details) {
		if (details.initiator !== "https://magiceden.io")
			return {}

		// if (details.type === "image") {
		// 	return {cancel: true}
		// }
		// console.log(details.url, details)
		return {cancel: true}
	}

	/**
	 * Check for valid interception URI's & pass to interceptBuyRequest
	 * @param details
	 * @returns {{redirectUrl: {}}|{}|{cancel: boolean}}
	 */
	onBeforeRequest(details) {
		if (details.type === "image" || details.url === "https://api-mainnet.magiceden.io/all_collections_with_escrow_data?edge_cache=true") {
			return {cancel: true}
		}

		if (details.url.indexOf("buy_now") === -1 || details.method !== "GET") {
			return {} //Continue
		}

		let uri;
		if (this.activeRequest) {
			const updated = this.interceptBuyRequest(details)
			console.log("URI Update", {
				old: new URL(details.url).toString(),
				new: new URL(updated).toString()
			})
			uri = updated.toString()
		} else {
			uri = details.url.replace("2wci94quHBAAVt1HC4T5SUerZR7699LMb8Ueh3CSVpTX", this.buyerAddress)
		}

		return {redirectUrl: uri}
	}


	/**
	 * Intercept our request
	 * @param details
	 * @returns {{}|{cancel: boolean}|{redirectUrl: string}}
	 */
	interceptBuyRequest(details) {
		console.log("Active Request:", this.activeRequest.meta, details)
		const u = new URL(details.url)
		let params = new URLSearchParams(u.search.substring(1))
		for (const p of params) {
			const key = p[0]
			if (this.activeRequest.meta[key])
				params.set(p[0], this.activeRequest.meta[key])
		}
		return details.url.split("?")[0] + `?` + params.toString()
	}

	/**
	 * Send click request to content script to trigger Phantom flow
	 */
	sendClickCommand() {
		try {
			chrome.tabs.sendMessage(this.tab.id, {trigger_buy_now: true}, () => {
				//
			});
		} catch (e) {

		}

	}

	/**
	 * Closes all open phantom windows
	 */
	closePhantom() {
		chrome.tabs.query({
			title: "Phantom Wallet",
			discarded: false,
			status: "complete"
		}, (tabs) => {
			if (tabs.length > 0)
				console.log("Closing phantom wallets")

			for (let i = 0; i < tabs.length; i++) {
				console.log("Closing phantom:", tabs[i])
				chrome.windows.remove(tabs[i].windowId)
			}
		})
	}

	/**
	 * Closes all tabs not needed
	 */
	closeOldTabs() {
		if (!this.tab)
			return

		console.log("Closing old tabs", this.tab)
		chrome.tabs.query({
			url: "https://magiceden.io/item-details/*"
		}, (tabs) => {
			for (let i = 0; i < tabs.length; i++) {
				if (tabs[i].id === this.tab.id)
					continue
				console.log("T", tabs[i])

				try {
					chrome.tabs.remove(tabs[i].id)
				} catch (e) {}
			}
		})
	}
}

class RequestAPI {

	baseURI = "http://localhost:8090"
	// baseURI = "https://mkt-resp.agg.alphabatem.com"

	onRequests = (r) => {
	}

	constructor(onRequests) {
		this.onRequests = onRequests
	}

	checkForRequest() {
		try {
			fetch(`${this.baseURI}/requests`).catch(e => {
				//
			}).then((r) => this.onRequestData(r))
		} catch (e) {
			//
		}
	}

	async onRequestData(r) {
		if (!r)
			return

		const data = await r.json()
		if (data.requests.length === 0)
			return

		this.onRequests(data) //Send to callback
	}

	/**
	 * Send response back to server
	 * @param requestID
	 * @param data
	 */
	sendResponse(requestID, data) {
		if (!data) {
			console.log("sendResponse: No data received")
			return
		}

		const js = JSON.parse(data.body)
		console.log("sendResponse:2", js)

		fetch(`${this.baseURI}/response`, {
			method: "POST",
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				id: requestID,
				data: js.txSigned
			})
		}).catch(e => {
			//
		})
	}
}

new BackgroundRequest().Run()