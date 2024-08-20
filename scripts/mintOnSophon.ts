import { createWalletClient, http, parseAbi } from "viem"
import { eip712WalletActions, getGeneralPaymasterInput, chainConfig, toSinglesigSmartAccount } from "viem/zksync"
import { task } from "hardhat/config"
import { defineChain } from "viem"



const SOPHON_TESTNET_PAYMASTER_ADDRESS = "0x950e3Bb8C6bab20b56a70550EC037E22032A413e";
const OPENFORT_SMART_ACCOUNT = "0x6700a65cA13b4A793EBdFfa4Db61AcC307350B10";


task("mint", "mint mock ERC20 on Sophon")
  .addParam("erc20", "The mockERC20 contract address")
  .setAction(async (args) => {
    const privateKey = process.env.WALLET_PRIVATE_KEY?.startsWith("0x") ? process.env.WALLET_PRIVATE_KEY : `0x${process.env.WALLET_PRIVATE_KEY}`
    const walletClient = createWalletClient({
      chain: sophon,
      transport: http("https://rpc.testnet.sophon.xyz"),
    }).extend(eip712WalletActions())

    const account = toSinglesigSmartAccount({
      address: OPENFORT_SMART_ACCOUNT, 
      privateKey: privateKey as `0x${string}`
    })

    const hash = await walletClient.writeContract({
      account,
      address: args.erc20,
      abi: parseAbi(["function mint(address sender, uint256 amount) external"]),
      functionName: "mint",
      args: [account.address, BigInt(42)],
      paymaster: SOPHON_TESTNET_PAYMASTER_ADDRESS,
      paymasterInput: getGeneralPaymasterInput({ innerInput: new Uint8Array() })
    });
    console.log(hash);
  });


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