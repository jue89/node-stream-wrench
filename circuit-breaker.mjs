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

		this.triggerSequences = triggerSequences.map((trigger) => {
			if (typeof trigger === 'string' || Buffer.isBuffer(trigger)) {
				trigger = {
					seq: trigger,
					err: `Found sequence: '${trigger.toString()}'`,
				};
			} else {
				assert(
					typeof trigger.seq === 'string' || Buffer.isBuffer(trigger.seq),
					'Trigger sequence must be of type String or Buffer'
				);
				assert(
					typeof trigger.err === 'string',
					'Trigger error must be of type String'
				);
			}

			return trigger;
		});

		this.triggerSequenceLen = this.triggerSequences.reduce((len, {seq}) => Math.max(len, seq.length), 0);
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

		for (const {seq, err} of this.triggerSequences) {
			if (this.buffer.includes(seq)) {
				return callback(new Error(err));
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
