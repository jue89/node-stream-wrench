import assert from 'node:assert/strict';
import {Transform} from 'node:stream';
import {Buffer} from 'node:buffer';

export default class CircuitBreaker extends Transform {
	constructor () {
		super();
		this.buffer = Buffer.alloc(0);
		this.triggerSequences = [];
		this.triggerSequenceLen = 0;
	}

	setTrigger (triggerSequences) {
		if (!Array.isArray(triggerSequences)) triggerSequences = [triggerSequences];
		for (let triggerSequence of triggerSequences) {
			assert(typeof triggerSequence === 'string' || Buffer.isBuffer(triggerSequence), 'Trigger sequence must be of type String or Buffer');
		}
		this.triggerSequenceLen = triggerSequences.reduce((len, word) => Math.max(len, word.length), 0);
		this.triggerSequences = triggerSequences;
		return this;
	}

	protectPromise (promise) {
		if (this.errored) {
			// Silently consume rejected promises
			// Otherwise, it'll kill the event loop due to unhandled rejections
			promise.catch(() => {});
			return Promise.reject(this.errored);
		}

		return new Promise((resolve, reject) => {
			this.once('error', reject);
			promise.then((result) => {
				this.removeListener('error', reject);
				resolve(result);
			}).catch((err) => {
				this.removeListener('error', reject);
				reject(err);
			});
		});
	}

	_transform (chunk, encoding, callback) {
		this.buffer = Buffer.concat([this.buffer, chunk]);

		for (const sequence of this.triggerSequences) {
			if (this.buffer.includes(sequence)) {
				return callback(new Error(`Found sequence: '${sequence}'`));
			}
		}

		// Crop buffer to max trigger sequence len
		if (this.triggerSequenceLen > 0) {
			this.buffer = this.buffer.subarray(this.triggerSequenceLen * -1);
		} else {
			this.buffer = Buffer.alloc(0);
		}

		callback(null, chunk);
	}
}
