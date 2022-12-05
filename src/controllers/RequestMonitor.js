class RequestMonitor {
	scraping = false

	activeRequest = null

	constructor() {
		setInterval(this.checkForRequest, 200)
	}

	checkForRequest() {
		if (this.scraping)
			return

		try {
			fetch("http://localhost:8090/requests").catch(e => {
				//
			}).then(this.onRequestData)
		} catch (e) {
			//
		}
	}

	async onRequestData(r) {
		if (this.scraping || !r)
			return

		const data = await r.json()
		// console.log("Data", data)

		const i = data.requests.length //We only try the last request
		const req = data.requests[i]
		this.activeRequest = req.meta
		console.log("New Scraper Request:", req)
		const scraper = new Scraper(req.id, req.meta.tokenMint)
		try {
			scraper.scrape()
		} catch (e) {
			console.error(`Unable to scrape ${req.meta.tokenMint}`, e)
		}

	}

	onTxnFound(data) {
		console.log("TXN Found: ", data)
		this.sendResponse(data)
		setTimeout(closePhantom, 1000)
	}

	sendResponse(data) {
		if (!data) {
			console.log("sendResponse: No data received")
			this.reset()
			return //Error
		}

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
			this.reset()
		})
	}

}