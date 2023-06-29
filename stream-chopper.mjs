import {Writable} from 'node:stream';
import {Buffer} from 'node:buffer';
import qsem from 'qsem';

export default class StreamChopper extends Writable {
	constructor () {
		super();
		this.mtx = qsem(1);
		this.fn = null;
	}

	async _install (fn) {
		await this.mtx.enter();
		this.fn = fn;
		this.emit('install');
	}

	async _feed (chunk) {
		while (chunk && chunk.length > 0) {
			// Make sure a consumer is present
			if (!this.fn) {
				await new Promise((resolve) => this.once('install', resolve));
			}

			chunk = await this.fn(chunk);
			if (chunk instanceof Buffer) {
				this.fn = null;
				this.mtx.leave();
			}
		}
	}

	_write (chunk, encoding, done) {
		this._feed(chunk)
			.then(() => done())
			.catch((err) => done(err));
	}

	async readUntil (needle) {
		let data = Buffer.alloc(0);
		const signal = qsem(0);
		await this._install((chunk) => {
			data = Buffer.concat([data, chunk]);
			const idx = data.indexOf(needle);
			if (idx === -1) {
				return null;
			} else {
				const remainder = data.subarray(idx + needle.length);
				data = data.subarray(0, idx);
				signal.leave();
				return remainder;
			}
		});
		await signal.enter();
		return data;
	}

	async seekUntil (needle) {
		let data = Buffer.alloc(0);
		const signal = qsem(0);
		await this._install((chunk) => {
			data = Buffer.concat([data, chunk]);
			const idx = data.indexOf(needle);
			if (idx === -1) {
				data = data.subarray(-needle.length);
				return null;
			} else {
				const remainder = data.subarray(idx + needle.length);
				signal.leave();
				return remainder;
			}
		});
		await signal.enter();
	}
}
