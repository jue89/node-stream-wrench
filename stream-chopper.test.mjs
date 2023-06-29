import StreamChopper from './stream-chopper.mjs';
import {Buffer} from 'node:buffer';
import {test} from 'node:test';
import assert from 'node:assert/strict';

test('chop stream after being written in one go', async () => {
	const s = new StreamChopper();
	s.write(Buffer.from('abc def ghi '));
	assert(Buffer.compare(await s.readUntil(' '), Buffer.from('abc')) === 0);
	await s.seekUntil(Buffer.from(' '));
	assert(Buffer.compare(await s.readUntil(Buffer.from(' ')), Buffer.from('ghi')) === 0);
});

test('chop stream while waiting for data', async () => {
	const s = new StreamChopper();
	const asyncData = [s.readUntil(' '), s.seekUntil(' '), s.readUntil(' ')];
	s.write('abc def ghi ');
	const data = await Promise.all(asyncData);
	assert(Buffer.compare(data[0], Buffer.from('abc')) === 0);
	assert(Buffer.compare(data[2], Buffer.from('ghi')) === 0);
});

test('chop stream written byte-wise', async () => {
	const s = new StreamChopper();
	const asyncData = [s.readUntil(' '), s.seekUntil(' '), s.readUntil(' ')];
	const input = Buffer.from('abc def ghi ');
	for (let i = 0; i < input.length; i++) {
		s.write(input.subarray(i, i + 1));
	}
	const data = await Promise.all(asyncData);
	console.log('b');
	assert(Buffer.compare(data[0], Buffer.from('abc')) === 0);
	assert(Buffer.compare(data[2], Buffer.from('ghi')) === 0);
});
