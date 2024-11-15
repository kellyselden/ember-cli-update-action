"use strict";
exports.id = 655;
exports.ids = [655];
exports.modules = {

/***/ 655:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* binding */ yn)
});

;// CONCATENATED MODULE: ./node_modules/yn/lenient.js
const YES_MATCH_SCORE_THRESHOLD = 2;
const NO_MATCH_SCORE_THRESHOLD = 1.25;

const yMatch = new Map([
	[5, 0.25],
	[6, 0.25],
	[7, 0.25],
	['t', 0.75],
	['y', 1],
	['u', 0.75],
	['g', 0.25],
	['h', 0.25],
	['j', 0.25],
]);

// eslint-disable-next-line unicorn/prevent-abbreviations
const eMatch = new Map([
	[2, 0.25],
	[3, 0.25],
	[4, 0.25],
	['w', 0.75],
	['e', 1],
	['r', 0.75],
	['s', 0.25],
	['d', 0.25],
	['f', 0.25],
]);

const sMatch = new Map([
	['q', 0.25],
	['w', 0.25],
	['e', 0.25],
	['a', 0.75],
	['s', 1],
	['d', 0.75],
	['z', 0.25],
	['x', 0.25],
	['c', 0.25],
]);

const nMatch = new Map([
	['h', 0.25],
	['j', 0.25],
	['k', 0.25],
	['b', 0.75],
	['n', 1],
	['m', 0.75],
]);

const oMatch = new Map([
	[9, 0.25],
	[0, 0.25],
	['i', 0.75],
	['o', 1],
	['p', 0.75],
	['k', 0.25],
	['l', 0.25],
]);

function getYesMatchScore(value) {
	// eslint-disable-next-line unicorn/prevent-abbreviations
	const [y, e, s] = value;
	let score = 0;

	if (yMatch.has(y)) {
		score += yMatch.get(y);
	}

	if (eMatch.has(e)) {
		score += eMatch.get(e);
	}

	if (sMatch.has(s)) {
		score += sMatch.get(s);
	}

	return score;
}

function getNoMatchScore(value) {
	const [n, o] = value;
	let score = 0;

	if (nMatch.has(n)) {
		score += nMatch.get(n);
	}

	if (oMatch.has(o)) {
		score += oMatch.get(o);
	}

	return score;
}

function lenient_lenient(input, default_) {
	if (getYesMatchScore(input) >= YES_MATCH_SCORE_THRESHOLD) {
		return true;
	}

	if (getNoMatchScore(input) >= NO_MATCH_SCORE_THRESHOLD) {
		return false;
	}

	return default_;
}

;// CONCATENATED MODULE: ./node_modules/yn/index.js


function yn(value, {
	lenient = false,
	default: default_,
} = {}) {
	value = String(value).trim();

	if (default_ !== undefined && typeof default_ !== 'boolean') {
		throw new TypeError(`Expected the \`default\` option to be of type \`boolean\`, got \`${typeof default_}\``);
	}

	if (/^(?:y|yes|true|1|on)$/i.test(value)) {
		return true;
	}

	if (/^(?:n|no|false|0|off)$/i.test(value)) {
		return false;
	}

	if (lenient === true) {
		return lenient_lenient(value, default_);
	}

	return default_;
}


/***/ })

};
;