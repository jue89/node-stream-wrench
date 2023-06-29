import CircuitBreaker from '../circuit-breaker.mjs';

// Setup with trigger sequence 'STOP'.
// All passed data is written to console output.
// Once it triggers, it'll write the error message to the console.
const cb = new CircuitBreaker();
cb.setTrigger('STOP');
cb.on('error', (e) => console.log(e.message));
cb.pipe(process.stdout);

// Can be used to guard promises.
// It'll handle promises transparently if the circuit breaker hasn't triggered, yet.
// Outputs: 42
cb.protectPromise(Promise.resolve(42)).then(console.log);
// Outputs: 13
cb.protectPromise(Promise.reject(13)).catch(console.log);

// Prints 'Hello world!' to stdout
cb.write('Hello world!\n');
// Prints 'Found sequence: STOP' to stdout
cb.write('STOP');

// Promises can't pass the circuit breaker anymore
// Outputs: Found sequence: 'STOP'
cb.protectPromise(Promise.resolve(42)).catch((e) => console.log(e.message));
// Outputs: Found sequence: 'STOP'
cb.protectPromise(Promise.reject(13)).catch((e) => console.log(e.message));
