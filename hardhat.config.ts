import { HardhatUserConfig } from "hardhat/config";
import "@matterlabs/hardhat-zksync";
import dotenv from "dotenv";

import "./scripts/mintOnSophon.ts";

// Load env file
dotenv.config()

const config: HardhatUserConfig = {
  defaultNetwork: "zkSyncLocal",
  // era_test_node fork mainnet
  networks: {
    zkSyncLocal: {
      url: "http://127.0.0.1:8011", // URL for the zkSync testnet
      ethNetwork: "mainnet", // The Ethereum network where zkSync operates (use "mainnet" for production)
      zksync: true,
    },
    zkTestnet: {
      url: "https://sepolia.era.zksync.dev", // The testnet RPC URL of ZKsync Era network.
      ethNetwork: "sepolia", // The Ethereum Web3 RPC URL, or the identifier of the network (e.g. `mainnet` or `sepolia`)
      zksync: true,
      // Verification endpoint for Sepolia
      verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
      accounts: [process.env.WALLET_PRIVATE_KEY as any]
    },
    zkSophonTestnet: {
      url: "https://rpc.testnet.sophon.xyz",
      ethNetwork: "sepolia",
      verifyURL: "https://api-explorer-verify.testnet.sophon.xyz/contract_verification",
      zksync: true,
      accounts: [process.env.WALLET_PRIVATE_KEY as any]
    }
  },
  zksolc: {
    version: "1.5.2", // Check for the latest version
    settings: {
      enableEraVMExtensions: true
      // find all available options in the official documentation
      // https://era.zksync.io/docs/tools/hardhat/hardhat-zksync-solc.html#configuration
    },
  },
  solidity: {
    version: "0.8.19",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};

export default config;