import { HardhatUserConfig } from "hardhat/config"
import "@matterlabs/hardhat-zksync"
import dotenv from "dotenv"

import "./tasks/createAccount.ts"
import "./tasks/deployAccount.ts"
import "./tasks/deployBatchCaller.ts"
import "./tasks/deployFactory.ts"
import "./tasks/deployMocks.ts"
import "./tasks/deployPaymaster.ts"
import "./tasks/prepareTests.ts"

// Load env file
dotenv.config()

const config: HardhatUserConfig = {
  defaultNetwork: "zkSyncLocal",
  // $ era_test_node fork mainnet
  networks: {
    zkSyncLocal: {
      url: "http://127.0.0.1:8011",
      ethNetwork: "mainnet",
      zksync: true,
      // constant accounts on era_test_node: https://github.com/matter-labs/era-test-node
      accounts: ["0x3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e"]
    },
    zkTestnet: {
      url: "https://sepolia.era.zksync.dev",
      ethNetwork: "sepolia",
      zksync: true,
      verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
      accounts: [process.env.WALLET_PRIVATE_KEY as any]
    },
    zkSophonTestnet: {
      url: "https://rpc.testnet.sophon.xyz",
      ethNetwork: "sepolia",
      verifyURL: "https://api-explorer-verify.testnet.sophon.xyz/contract_verification",
      zksync: true,
      accounts: [process.env.WALLET_PRIVATE_KEY as any]
    },
    zkSophonMainnet: {
      url: "https://rpc.sophon.xyz",
      ethNetwork: "mainnet",
      verifyURL: "https://verification-explorer.sophon.xyz/contract_verification",
      zksync: true,
      accounts: [process.env.WALLET_PRIVATE_KEY as string]
    },
    abstractTestnet: {
      url: "https://api.testnet.abs.xyz",
      ethNetwork: "sepolia",
      zksync: true,
      verifyURL: "https://api-explorer-verify.testnet.abs.xyz/contract_verification",
      chainId: 11124,
      accounts: [process.env.WALLET_PRIVATE_KEY as string]
    },
  },
  zksolc: {
    version: "1.5.2",
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

export default config