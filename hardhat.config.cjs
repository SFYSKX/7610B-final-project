require('@nomicfoundation/hardhat-ethers');
const fs = require('node:fs');
if (fs.existsSync('.env') && process.loadEnvFile) process.loadEnvFile('.env');
const { subtask } = require('hardhat/config');
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require('hardhat/builtin-tasks/task-names');
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async ({ solcVersion }, hre, next) => {
  if (solcVersion === '0.8.24') return { compilerPath: require.resolve('solc/soljson.js'), isSolcJs:true, version:solcVersion, longVersion:require('solc').version() };
  return next();
});
module.exports = {
  solidity:{version:'0.8.24',settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris'}},
  networks:{hardhat:{chainId:31337,loggingEnabled:false,mining:{auto:true,interval:0}},localhost:{url:process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545',chainId:31337},
    sepolia:{url:process.env.SEPOLIA_RPC_URL || 'http://127.0.0.1:1',chainId:11155111,
      accounts:process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : []}}
};
