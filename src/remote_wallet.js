import {web3} from "@project-serum/anchor";
import bs58 from 'bs58'

class RemoteSolanaWallet {
	isPhantom = true
	isConnected = false

	listeners = {}

	publicKey = null;

	channel = null

	constructor() {
		window.addEventListener("message", (e) => {
			this.onMessage(e)
		})
	}

	onMessage(e) {
		if (!e.data.type)
			return

		console.log("remote_wallet onmsg: ", e.data)

		if (e.data.type === "change_wallet") {
			console.log("remote_wallet::onMessage - message", e.data)
			this.changeAccountTo(e.data.payload)
			return;
		}

		if (e.data.type === "alpha_msg_resp") {
			console.log("remote_wallet::onMessage - message", e.data)
			if (this.channel && this.channel.port2)
				this.channel.port2.postMessage(e.data)
		}
	}

	changeAccountTo(newAccount) {
		console.log("Remote Wallet changeAccountTo", newAccount)
		this.publicKey = new web3.PublicKey(newAccount)

		console.log("New PK: ", this.publicKey)
		// this.emit("disconnect", this.publicKey)
		this.emit("accountChanged", this.publicKey)
		// this.emit("connect", this.publicKey)
	}

	connected() {
		return this.isConnected
	}

	connecting() {
		return false
	}

	readyState() {
		return 1
	}

	getPublicKey() {
		return this.publicKey
	}

	waitConnected(cb) {
		const t = setTimeout(() => {
			if (!this.connected())
				return

			clearTimeout(t)
			cb()
		}, 1000)
	}

	connect() {
		return new Promise((ok, err) => {
			if (!this.publicKey) {
				this.waitConnected(ok)
				return
			}

			this.emit("connect", this.publicKey)
			this.isConnected = true
			ok()
		})
	}

	disconnect() {
		console.log("FAKER disconnect")
		return new Promise((ok, err) => {
			this.isConnected = false
			ok()
		})
	}

	postMessage(t) {
		console.log("FAKER postMessage", t)
		return new Promise((ok, err) => {
			ok()
		})
	}

	request(t) {
		console.log("FAKER request", t)
		return new Promise((ok, err) => {
			ok()
		})
	}

	signAllTransactions() {
		console.log("FAKER signAllTransactions", t)
		return new Promise((ok, err) => {
			ok()
		})
	}

	signAndSendTransactions(t) {
		console.log("FAKER signAndSendTransactions", t)
		return new Promise((ok, err) => {
			ok()
		})
	}


	msgCount = 0

	signMessage(t) {
		if (!this.connected() || !this.publicKey) {
			console.log("SKIP FAKER signMessage")
			return new Promise((o, e) => e())
		}

		// if (this.msgCount !== 1) {
		// 	console.log("SKIP FAKER signMessage", this.msgCount)
		// 	this.msgCount++
		// 	return new Promise((o, e) => e())
		// }

		const smsg = new TextDecoder().decode(t)
		console.log("FAKER signMessage", smsg)
		return this.sendMessage("signMessage", smsg)
	}

	signTransaction(t) {
		console.log("FAKER signTransaction", t)
		setTimeout(() => {
			localStorage.clear()
			// window.location.reload()
		}, 600)
		return new Promise((ok, err) => {
			err()
		})
	}

	on(event, listener) {
		this.listeners[event] = [listener]
	}

	off(event, listener) {
		this.listeners[event] = []
	}

	emit(event, args) {
		if (!this.listeners[event] || this.listeners[event].length === 0)
			return

		this.listeners[event][0](args)
	}


	sendMessage(method, data) {
		return new Promise((res, rej) => {
			setTimeout(() => {
				rej()
			}, 12000)

			this.channel = new MessageChannel();
			this.channel.port1.onmessage = ({data}) => {
				if (!data.payload) {
					console.log("Data payload empty")
					rej()
					return
				}

				if (data.type && data.type === "alpha_msg_resp") {
					let response = null
					console.log("inject Response", data)
					switch (data.method) {
						case "connect":
							this.isConnected = true;
							this.publicKey = new web3.PublicKey(data.payload)
							break
						case "signMessage":
							const signatureArray = []
							const dp = new TextEncoder().encode(data.payload)
							const keys = Object.keys(dp)

							for (let i = 0; i < keys.length; i++) {
								signatureArray.push(dp[keys[i]])
							}

							response = {
								publicKey: this.publicKey,
								signature: bs58.decode(data.payload)
							}
							break
					}

					this.channel = null //Clear channel
					if (data.error) {
						console.log("Reject", data)
						rej(data.error);
					} else {
						console.log("Response", response)
						res(response);
					}
				}
			};

			window.postMessage({
				type: "alpha_msg",
				method: method,
				payload: data
			})
		})
	}
}


class RemoteWallet {
	solana = new RemoteSolanaWallet()
}

if (!window.phantom)
	window.phantom = {
		solana: new RemoteSolanaWallet()
	}