class Scraper {

	tab
	requestID = ""
	tokenAddr = ""

	constructor(requestID, tokenAddr) {
		this.requestID = requestID
		this.tokenAddr = tokenAddr
		console.log("Scraping: ", tokenAddr)
		setTimeout(() => this.onTimeout(), 10000)
	}

	scrape() {
		scraping = true

		chrome.tabs.query({
			url: "https://magiceden.io/item-details/*",
			discarded: false,
		}, (tabs) => {
			this.onExistingTabs(tabs)
		})
	}

	onExistingTabs(tabs) {
		if (tabs.length === 0) {
			chrome.tabs.create({
				active: true,
				url: `https://magiceden.io/item-details/${this.tokenAddr}`,
			}, (tab) => {
				console.log("Using new tab", tab)
				this.onCreate(tab)
			})

			return
		}

		if (!this.tab) {
			this.onCreate(tabs[0])
			return;
		}

		//We have a tab already open - use this with our meta
		// const firstTab = tabs[0]
		console.log("Using pre-existing tab", this.tab)
		// this.onCreate(firstTab)

		console.log("Sending", this.tab.id)
		this.sendClickCommand()
	}

	sendClickCommand() {
		chrome.tabs.sendMessage(this.tab.id, {trigger_buy_now: true}, () => {
			//
		});
	}

	onCreate(tab) {
		this.tab = tab
		console.log("Tab created", tab)
		chrome.debugger.attach({ //debug at current tab
			tabId: this.tab.id
		}, "1.0", () => this.onAttach());
	}


	onAttach() {
		console.log("Tab attached", this.tab)

		chrome.debugger.sendCommand({ //first enable the Network
			tabId: this.tab.id
		}, "Network.enable");
	}

	onTimeout() {
		this.reset()
	}

	reset() {
		this.clearIsScraping()
		this.closeTab()
		chrome.debugger.onEvent.removeListener((d, m, p) => {
			this.allEventHandler(d, m, p)
		});
		closePhantom()
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

}
