class BackgroundRequest {
	buyerAddress = "2PMP31sXqLKmtaR1oSW9pSMPj3aRQPNsyTurrK8Xguhc"

	lastCompletedReqID = ""

	activeRequest = null

	//Buffer for running bulk purchases
	bulkRequests = []

	dummyItem = "EiKqyAm9EaXtPA3A61bwEZbo5kgcu9rduhhmBoVZCN6W"

	//Tab to use
	tab

	// pollTime = 400
	pollTime = 1000

	// baseURI = "http://localhost:8090"
	baseURI = "https://mkt-resp.agg.alphabatem.com"

	arkose = new ArkoseSolver()


	constructor() {
		chrome.runtime.onMessage.addListener((r, s, cb) => this.onMessage(r, s, cb))
		chrome.webRequest.onBeforeRequest.addListener((d) => this.onBeforeRequest(d), {urls: ["https://*.magiceden.io/*"]}, ["blocking"])
		chrome.webRequest.onBeforeSendHeaders.addListener((d) => this.onBeforeHeaders(d), {urls: ["https://*.magiceden.io/*"]}, ["blocking", "requestHeaders", "extraHeaders"])
		chrome.webRequest.onBeforeRequest.addListener((d) => this.onBeforeArkoseRequest(d), {urls: ["https://*.arkoselabs.com/*"]}, ["blocking"])
		chrome.webRequest.onBeforeRequest.addListener((d) => this.onBeforeRequestMediaBlock(d), {urls: ["https://nftstorage.link/*", "https://img-cdn.magiceden.dev/*", "https://*.arweave.net/*", "https://*.ipfs.nftstorage.link/*", "https://ipfs.io/*", "https://shdw-drive.genesysgo.net/*", "https://img-cdn.magiceden.dev/*"]}, ["blocking"])

		//Listen on returning message
		chrome.debugger.onEvent.addListener((d, m, p) => this.onEvent(d, m, p))


		//Close phantom regularly
		setInterval(this.closePhantom, 1000)
		setInterval(this.closeSolflare, 1000)

		//Close any misc tabs
		setInterval(() => {
			this.closeOldTabs()
		}, 20000)

		this.requestMon = new RequestAPI(this.baseURI, (r) => this.onNewRequest(r))
	}


	onNewRequest(data) {
		const lastReq = data.requests[data.requests.length - 1]
		if (lastReq.id === this.lastCompletedReqID) {
			console.log("Skipping old Request: ", lastReq)
			return true //Already done request
		}

		console.log("New Request: ", lastReq)
		// console.log("Sending to Tab:", this.tab.id)
		this.activeRequest = lastReq

		if (this.baseURI.indexOf("localhost") > 0)
			this.sendClickBuyNowCommand()
		else
			this.sendLoginCommand() //Login as user and obtain message to sign

		setTimeout(() => {
			if (!this.activeRequest || this.activeRequest.id !== lastReq.id)
				return

			this.clearActiveRequest()
		}, 40000)

		return true;
	}

	onTxnFound(data) {
		console.log("TXN Found: ", data, this.activeRequest)
		if (!this.activeRequest)
			return true //No longer useful

		//We have all our requests
		if (this.activeRequest.is_bulk && this.bulkRequests.length !== this.activeRequest.requests.length) {
			this.bulkRequests.push(data)
			return true
		}

		this.lastCompletedReqID = this.activeRequest.id; //Set as last active
		try {

			if (this.activeRequest.is_bulk)
				this.requestMon.sendBulkResponse(this.activeRequest.id, this.bulkRequests)
				else
			this.requestMon.sendResponse(this.activeRequest.id, data)
		} catch (e) {
			console.error("Unable to send txn response", e)
		}

		this.clearActiveRequest()

		return true;
	}

	Run() {
		//Create base tab to use (we use a low value ABTM item as our placeholder item)
		this.createBaseTab()

		//Give it time to load
		setTimeout(() => {
			this.pollNewRequests()
		}, 10000)

		//Start polling for requests
		// this.pollNewRequests()
	}

	pollNewRequests() {
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
		if (!this.activeRequest.is_bulk) {
			console.log("Sending logout command")
			this.sendLogoutCommand()
		}

		this.activeRequest = null
		this.bulkRequests = []
	}

	createBaseTab() {
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
		chrome.debugger.attach({ //debug at current tab
			tabId: this.tab.id
		}, "1.0", () => this._onAttach());
		console.log("Tab created", tab)
	}


	_onAttach() {
		chrome.debugger.sendCommand({ //first enable the Network
			tabId: this.tab.id
		}, "Network.enable");
		console.log("Tab attached", this.tab)
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
		console.log(`onEvent`, {
			debuggeeId: debuggeeId,
			msg: message,
			params: params
		})


		setTimeout(() => {
			try {
				chrome.debugger.sendCommand({
					tabId: debuggeeId.tabId
				}, "Network.getResponseBody", {
					"requestId": params.requestId
				}, (response) => {
					if (params.response.url.indexOf("buy_now") > -1)
						this.onTxnFound(response)
				});
			} catch (e) {
				console.log("Unable to get response!")
			}
		}, 600)

		return true;
	}

	/**
	 * Handle inbound message from content script
	 * @param request
	 * @param sender
	 * @param sendResponse
	 */
	onMessage(request, sender, sendResponse) {
		if (!this.activeRequest) {
			sendResponse()
			return true
		}

		console.log("New Message", request)

		if (request.method === "signMessage") {

			this.requestMon.sendSignatureExchange(this.activeRequest.id, request.data).then((r) => {
				console.log("SigExchange raw", r)
				r.json().then(j => {
					console.log("Signature exchange response", j)
					sendResponse(j.signature)
				}).then(() => {
					setTimeout(() => {
						console.log("Sending click buy now")
						this.sendClickBuyNowCommand()
					}, 1000)
				})
			})

			return true //Needs to wait on sendResponse
		}

		if (request.type === "captcha") {
			this.arkose.solve()
			return true
		}

		if (request.failed) {
			console.log("Failed to get TXN Data")
			// window.location.reload()
			// chrome.tabs.remove(sender.tab.id)
		}
		sendResponse()

		return true;
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

	onBeforeHeaders(details) {
		if (details.url.indexOf("buy_now") === -1) {
			return {requestHeaders: details.requestHeaders} //Continue
		}

		if (this.activeRequest && this.activeRequest.sessionToken)
			details.requestHeaders.push({
				name: "x-browser-session",
				value: this.activeRequest.sessionToken,
			})


		return {requestHeaders: details.requestHeaders};
	}

	onBeforeArkoseRequest(details) {

		if (details.url.indexOf("sessionToken") !== -1) {
			//Arkose challenge image
			this.arkose.onChallengeImage(details.url)
		}


		if (details.url.indexOf("fc") !== -1) {
			//Arkose details urls
		}
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
	sendClickBuyNowCommand() {
		try {
			chrome.tabs.sendMessage(this.tab.id, {
				type: "buy_now",
				data: this.activeRequest,
			}, () => {
				//
				return true
			});
		} catch (e) {
			console.log("Unable to send click command", e)
		}
	}

	/**
	 * Send click request to content script to trigger login flow
	 */
	sendLoginCommand() {
		try {
			chrome.tabs.sendMessage(this.tab.id, {
				type: "login",
				data: this.activeRequest,
			}, () => {
				//
				return true
			});
		} catch (e) {
			console.log("Unable to send login command", e)
		}
	}

	/**
	 * Send click request to content script to trigger logout flow
	 */
	sendLogoutCommand() {
		try {
			chrome.tabs.sendMessage(this.tab.id, {
				type: "logout",
			}, () => {
				//
				return true
			});
		} catch (e) {
			console.log("Unable to send logout command", e)
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
				// console.log("Closing phantom wallets")

				for (let i = 0; i < tabs.length; i++) {
					// console.log("Closing Solflare:", tabs[i])
					chrome.windows.remove(tabs[i].windowId)
				}
		})
	}

	/**
	 * Closes all open solflare windows
	 */
	closeSolflare() {
		chrome.tabs.query({
			title: "Solflare",
			discarded: false,
			status: "complete"
		}, (tabs) => {
			if (tabs.length > 0)
				// console.log("Closing solflare wallets")

				for (let i = 0; i < tabs.length; i++) {
					// console.log("Closing phantom:", tabs[i])
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

		chrome.tabs.query({
			url: "https://magiceden.io/item-details/*"
		}, (tabs) => {
			for (let i = 0; i < tabs.length; i++) {
				if (tabs[i].id === this.tab.id)
					continue
				try {
					chrome.tabs.remove(tabs[i].id)
				} catch (e) {
				}
			}
		})
	}
}

class RequestAPI {

	baseURI

	onRequests = (r) => {
	}

	constructor(baseURI, onRequests) {
		this.baseURI = baseURI
		this.onRequests = onRequests
	}

	checkForRequest() {
		try {
			fetch(`${this.baseURI}/requests/next`).catch(e => {
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
	 * Send bulk response back to server
	 * @param requestID
	 * @param data
	 */
	sendBulkResponse(requestID, data) {
		if (!data) {
			console.log("sendResponse: No data received")
			return
		}

		const payload = [];
		for (let i = 0; i < data.length;i++) {
			const js = JSON.parse(data.body)
			payload.push(js.txSigned)
		}

		console.log("sendResponseBulk:2", payload)

		return fetch(`${this.baseURI}/response`, {
			method: "POST",
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				id: requestID,
				data: payload
			})
		}).catch(e => {
			//
		})
	}

	/**
	 * Send response back to server
	 * @param requestID
	 * @param data []Requests
	 */
	sendResponse(requestID, data) {
		if (!data) {
			console.log("sendResponse: No data received")
			return
		}

		const js = JSON.parse(data.body)
		console.log("sendResponse:2", js)

		return fetch(`${this.baseURI}/response`, {
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

	sendSignatureExchange(requestID, data) {
		console.log(`${requestID} sendSignatureExchange`, data)

		// const js = JSON.parse(data.body)

		return fetch(`${this.baseURI}/signature_exchange`, {
			method: "POST",
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				requestId: requestID,
				data: window.btoa(data)
			})
		}).catch(e => {
			//
		})
	}
}

//IP Rotation
class ProxyRotation {
	constructor() {
	}

}

//Randomly hop around listings we can afford
class PageManager {
	constructor() {
	}

	newListingPage() {
		return ""
	}
}

class ArkoseSolver {
	basePath = "http://localhost:8999"
	solverBasePath = "https://mkt.agg.alphabatem.com"

	//Should do this recursively until the challenge is completed
	solve() {
		console.log("Attempting to solve arkose challenge")
		this.clickStartButton()
		//Once we have handed over to the click workflow we pretty much just wait for it to complete
		//TODO Poll for failure message on vision side
		//TODO Poll for completion to continue with content workflow?
	}


	clickStartButton() {
		return fetch(`${this.basePath}/puzzle/start`)
	}

	clickRestartButton() {
		return fetch(`${this.basePath}/puzzle/start`)
	}

	checkPuzzleError() {
		return fetch(`${this.basePath}/puzzle/err_check`)
	}

	clickOptionButton(answer) {
		if (answer === -1) {
			console.log("Unable to get correct answer, guessing")
			answer = Math.floor(Math.random() * 5);
		}


		setTimeout(() => this.checkPuzzleError(), 2000) //Check for an error after
		return fetch(`${this.basePath}/puzzle/option`, {
			method: "POST",
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				answer: answer,
			})
		})
	}

	onChallengeImage(uri) {
		return fetch(`${this.solverBasePath}/captcha/funcaptcha/solve`, {
			method: "POST",
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				image_url: uri,
			})
		}).then(r => {
			r.json().then((data) => {
				console.log("Challenge answer:", data)
				setTimeout(() => {
					this.clickOptionButton(data.answer)
				}, 800) //Give it some time to load
			})
		})
	}
}


new BackgroundRequest().Run()