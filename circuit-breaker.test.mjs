import CircuitBreaker from './circuit-breaker.mjs';
import {Buffer} from 'node:buffer';
import {test, mock} from 'node:test';
import assert from 'node:assert/strict';

async function write (stream, input) {
	await new Promise((resolve) => stream.write(input, resolve));
}

test('trigger on stop sequence', async () => {
	const onError = mock.fn();
	const onData = mock.fn();
	const cb = new CircuitBreaker();
	cb.setTrigger('STOP').on('error', onError).on('data', onData);
	await write(cb, 'test');
	await write(cb, Buffer.from('STOP'));
	await write(cb, 'suppressed');
	assert.equal(onError.mock.calls[0].arguments[0].message, 'Found sequence: \'STOP\'');
	assert.equal(onData.mock.calls.length, 1);
	assert.equal(onData.mock.calls[0].arguments[0].toString(), 'test');
});

test('trigger on stop sequence chunked', async () => {
	const onError = mock.fn();
	const cb = new CircuitBreaker();
	cb.setTrigger('STOP').on('error', onError);
	for (let char of 'test') {
		await write(cb, char);
	}
	for (let char of 'STOP') {
		await write(cb, char);
	}
	assert.equal(onError.mock.calls.length, 1);
});

test('protect promises', async () => {
	const cb = new CircuitBreaker();
	cb.setTrigger(Buffer.from('STOP'));
	assert.equal(await cb.protectPromise(Promise.resolve(42)), 42);
	await assert.rejects(cb.protectPromise(Promise.reject(new Error('foo'))), {message: 'foo'});
	let resolve;
	const deferred = cb.protectPromise(new Promise((r) => {
		resolve = r;
	}));
	await write(cb, 'STOP');
	resolve();
	await assert.rejects(deferred);
	await assert.rejects(cb.protectPromise(Promise.resolve(42)));
	await assert.rejects(cb.protectPromise(Promise.reject(42)));
});

test('make sure to remove error listeners', async () => {
	const cb = new CircuitBreaker();
	for (let i = 0; i < 100; i++) {
		await cb.protectPromise(Promise.resolve());
		await cb.protectPromise(Promise.reject()).catch(() => {});
	}
	assert.equal(cb.listenerCount('error'), 0);
});

test('do not trigger on sequences that have been set after arrival', async () => {
	const onData = mock.fn();
	const cb = new CircuitBreaker();
	cb.on('data', onData);
	await write(cb, 'STOP');
	cb.setTrigger(Buffer.from('STOP'));
	await write(cb, 'foo');
	assert.equal(onData.mock.calls.length, 2);
});

test('define own error messages', async () => {
	const onError = mock.fn();
	const cb = new CircuitBreaker();
	cb.setTrigger({
		seq: 'STOP',
		err: 'Custom error',
	}).on('error', onError);
	await write(cb, 'STOP');
	assert.equal(onError.mock.calls[0].arguments[0].message, 'Custom error');
});
