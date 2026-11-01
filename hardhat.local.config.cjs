// A persistent demonstration node must advance time even without user transactions.
// Tests and gas benchmarks use hardhat.config.cjs with no interval timer.
const config = require('./hardhat.config.cjs');
config.networks.hardhat.mining = {auto: true, interval: 2000};
module.exports = config;
