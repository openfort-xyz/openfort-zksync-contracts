import { createWalletClient, http, defineChain } from "viem"
import { eip712WalletActions, chainConfig, toSinglesigSmartAccount, zksyncSepoliaTestnet } from "viem/zksync"
import { task } from "hardhat/config"


task("test")
  .addFlag("skipDeployments", "Requires ACCOUNT_IMPLEMENTATION_ADDRESS env var")
  .addOptionalParam("accountNonce", "Number to generate predictive address with CREATE2")
  .setAction(async (args, hre, runSuper) => {

    let address = process.env.ACCOUNT_IMPLEMENTATION_ADDRESS
    const isSophon = hre.network.config.url.includes("sophon")

    if (!args.skipDeployments) {
      const {factory, implementation} = await hre.run("deploy-factory")
      // wait for sophon backend service to whitelist the factory in their paymaster
      if (isSophon) sleep(60000)
      address = await hre.run("create-account", { factory, implementation, nonce: args.accountNonce })
    }

    // configure viem smart account
    const walletClient = createWalletClient({
      chain: isSophon ? sophon : zksyncSepoliaTestnet,
      transport: http(hre.network.config.url),
    }).extend(eip712WalletActions())

    const account = toSinglesigSmartAccount({
      address: address as `0x${string}`,
      privateKey: hre.network.config.accounts[0],
    })

    return runSuper(walletClient, account)
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