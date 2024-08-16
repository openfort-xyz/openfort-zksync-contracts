import "@matterlabs/hardhat-zksync-deploy"
import "@matterlabs/hardhat-zksync-solc"
import "@matterlabs/hardhat-zksync-upgradable"

import "tsconfig-paths/register"

module.exports = {
  zksolc: {
    version: "latest", // Check for the latest version
    compilerSource: "binary",
    settings: {
      enableEraVMExtensions: true,
    },
  },
  defaultNetwork: "zkSyncLocal",
  networks: {
    zkSyncLocal: {
      url: "http://127.0.0.1:8011", // URL for the zkSync testnet
      ethNetwork: "", // in-memory node doesn't support eth node; removing this line will cause an error
      zksync: true,
      accounts:[process.env.WALLET_PRIVATE_KEY as any]
    },
  },
  solidity: {
    version: "0.8.19",
  },
};