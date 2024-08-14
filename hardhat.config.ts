import "@matterlabs/hardhat-zksync-deploy"
import "@matterlabs/hardhat-zksync-solc"
import "@matterlabs/hardhat-zksync-upgradable"

import "tsconfig-paths/register"

module.exports = {
  zksolc: {
    version: "1.5.0", // Check for the latest version
    isSystem: true,
    compilerSource: "binary",
    settings: {},
  },
  defaultNetwork: "zkSyncLocal",
  networks: {
    zkSyncLocal: {
      url: "http://127.0.0.1:8011", // URL for the zkSync testnet
      ethNetwork: "mainnet", // The Ethereum network where zkSync operates (use "mainnet" for production)
      zksync: true,
    },
  },
  solidity: {
    version: "0.8.19",
  },
};