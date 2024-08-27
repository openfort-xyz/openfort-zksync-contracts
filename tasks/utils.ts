import { defineChain, WalletClient } from "viem"
import { chainConfig, getGeneralPaymasterInput, zksyncInMemoryNode, zksyncSepoliaTestnet } from "viem/zksync"

import { getPaymasterParams } from "zksync-ethers/build/paymaster-utils"
import { DEFAULT_GAS_PER_PUBDATA_LIMIT } from "zksync-ethers/build/utils"

export async function writeContract(c: WalletClient, contractParams) {    
    // add paymaster info for sophon
    if (hre.network.config.url.includes("sophon")) {
        contractParams.paymaster = process.env.SOPHON_TESTNET_PAYMASTER_ADDRESS
        contractParams.paymasterInput = getGeneralPaymasterInput({ innerInput: new Uint8Array() })
      }
    return c.writeContract(contractParams)
}


// ETHERS 6 version
export function buildTransactionRequest(params) {
  if (hre.network.config.url.includes("sophon")) {
    const paymasterParams = getPaymasterParams(process.env.SOPHON_TESTNET_PAYMASTER_ADDRESS!, {
      type: "General",
      innerInput: new Uint8Array(),
    });
    return {
      ...params,
      customData: {
        paymasterParams,
        gasPerPubdata: DEFAULT_GAS_PER_PUBDATA_LIMIT,
      }
    }
  }
  return params
}


export function getViemChainFromConfig() {
    const sophon = defineChain({
        ...chainConfig,
        id: 531050104,
        name: "Sophon",
        network: "sepolia",
        nativeCurrency: {
          name: "SOPHON",
          symbol: "SOPH",
          decimals: 18,
        },
        rpcUrls: {
          default: {
            http: ["https://rpc.testnet.sophon.xyz"],
          },
          public: {
            http: ["https://rpc.testnet.sophon.xyz"],
          },
        },
        blockExplorers: {
          default: {
            name: "Sophon Testnet Explorer",
            url: "https://explorer.testnet.sophon.xyz/",
          },
        },
        testnet: true,
      })

    switch (hre.network.config.url) {
        case "http://127.0.0.1:8011":
            return zksyncInMemoryNode
        case "https://sepolia.era.zksync.dev":
            return zksyncSepoliaTestnet
        case "https://rpc.testnet.sophon.xyz":
            return sophon
        default:
            throw new Error("Unkown network")
    }
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}