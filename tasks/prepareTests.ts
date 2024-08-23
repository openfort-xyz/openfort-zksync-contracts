import { defineChain } from "viem"
import { chainConfig, zksyncSepoliaTestnet } from "viem/zksync"
import { task } from "hardhat/config"


task("test")
  .addFlag("skipDeployments", "Requires ACCOUNT_IMPLEMENTATION_ADDRESS env var")
  .addOptionalParam("accountNonce", "Number to generate predictive address with CREATE2")
  .setAction(async (args, hre, runSuper) => {

    let address = process.env.ACCOUNT_IMPLEMENTATION_ADDRESS
    const chain = hre.network.config.url.includes("sophon") ? sophon : zksyncSepoliaTestnet

    if (!args.skipDeployments) {
      const {factory, implementation} = await hre.run("deploy-factory")
      // wait for sophon backend service to whitelist the factory in their paymaster
      if (chain == sophon) sleep(60000)
      address = await hre.run("create-account", { factory, implementation, nonce: args.accountNonce })
    }

    hre.chain = chain
    hre.openfortAccountAddress = address

    return runSuper()
  })


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

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}