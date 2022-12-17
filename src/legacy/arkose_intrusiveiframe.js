/**
 * WIP Version of controlling Arkeos iframes through pure JS (if bypassing CSP is possible on iframe)
 *
 * Was started but never finished (swapped to using the mouse controller workflow instead)
 */


class ArkoseSolver {

	//Should do this recursively until the challenge is completed
	solve() {
		console.log("Attempting to solve arkose challenge")
		this._startChallenge()
	}

	_startChallenge() {
		const btn = findButton("Start Puzzle")
		if (!btn) {
			throw Error("unable to find start button")
		}

		btn.click()
		this.pollForButton("restart", this._onChallengeStarted)
	}

	_onChallengeStarted() {
		console.log("Challenge started")

		const title = "";
		const imgSrc = this._scrapeChallengeImage()

		this.toDataURL(imgSrc, (img) => {
			this._solveChallengeImage(title, img, this._onChallengeSolved)
		})
	}


	_onChallengeSolved(r) {
		console.log("_onChallengeSolved", r)
		this._selectAnswer(1) //TODO bind to response
	}

	_scrapeChallengeImage() {
		const btns = document.getElementsByTagName("button")
		for (let i = 0; i < btns.length; i++) {
			const bg = btns[i].style.backgroundImage
			if (!bg)
				continue

			if (bg.indexOf("arkoselabs") > -1)
				return bg
		}
		return null
	}

	_solveChallengeImage(title, img, onSolved) {
		fetch(`${this.baseURI}/challenges`, {
			method: "POST",
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: title,
				img: img
			})
		}).catch(e => {
			console.log("Unable to send challenge image")
		}).then((r) => {
			console.log("Challenge solved: ", r)
			onSolved(r)
		})
	}

	_selectAnswer(idx) {
		const options = document.getElementsByClassName("challenge-container")[0].children[0].children
		options[idx].click()
	}


	pollForButton(btnText, onFound, attempts = 0) {
		if (attempts > 5) {
			throw Error(`timeout waiting for button: ${btnText}`)
		}

		setTimeout(() => {
			const btn = findButton("Start Puzzle")
			if (!btn) {
				this.pollForButton(btnText, onFound, attempts++)
			}
		}, 400)
	}

	toDataURL(url, callback) {
		const xhr = new XMLHttpRequest();
		xhr.onload = function () {
			const reader = new FileReader();
			reader.onloadend = function () {
				callback(reader.result);
			}
			reader.readAsDataURL(xhr.response);
		};
		xhr.open('GET', url);
		xhr.responseType = 'blob';
		xhr.send();
	}
}