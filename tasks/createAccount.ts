import { createWalletClient, http, parseAbi, numberToHex, keccak256, encodeAbiParameters, parseAbiParameters, defineChain } from "viem"
import { eip712WalletActions, getGeneralPaymasterInput, chainConfig, zksyncSepoliaTestnet } from "viem/zksync"
import { privateKeyToAccount } from "viem/accounts"
import { utils } from "zksync-ethers"
import { task } from "hardhat/config"

task("create-account", "Create and Initialize an Openfort Upgradeable Account")
  .addParam("factory", "Factory address")
  .addParam("implementation", "Account Implementation address")
  .addParam("nonce", "Number to generate predictive address with CREATE2")
  .setAction(async (args, hre) => {

    const chain = hre.network.config.url.includes("sophon") ? sophon : zksyncSepoliaTestnet
    const walletClient = createWalletClient({
      chain,
      transport: http(hre.network.config.url),
    }).extend(eip712WalletActions())

    const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`)
    const nonce = numberToHex(args.nonce, {size: 32})

    const contractOptions = {
      account,
      address: args.factory,
      abi: parseAbi(["function createAccountWithNonce(address _admin, bytes32 _nonce, bool _initializeGuardian) external"]),
      functionName: "createAccountWithNonce",
      args: [account.address, nonce, true],
    }

    if (hre.network.config.url.includes("sophon")) {
      contractOptions.paymaster = process.env.SOPHON_TESTNET_PAYMASTER_ADDRESS
      contractOptions.paymasterInput = getGeneralPaymasterInput({ innerInput: new Uint8Array() })
    }

    await walletClient.writeContract(contractOptions)
    const accountProxy = await hre.run("get-account", { factory: args.factory, implementation: args.implementation, nonce })
    return accountProxy
  })


task("get-account", "Compute zkSync create2 address of an account")
  .addParam("factory", "Factory Address")
  .addParam("implementation", "Account Implementation address")
  .addParam("nonce", "Number to generate predictive address with CREATE2")
  .setAction(async (args, hre) => {
    const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`)
    const proxyArtifactName = "UpgradeableOpenfortProxy";
    const proxyArtifact = await hre.deployer.loadArtifact(proxyArtifactName);
    const abiTypes = parseAbiParameters("address, bytes32");
    const nonce = numberToHex(args.nonce, {size: 32})
    const encodedData = encodeAbiParameters(abiTypes, [account.address, nonce])
    const salt = keccak256(encodedData, "bytes")
    // https://docs.zksync.io/build/developer-reference/ethereum-differences/evm-instructions#address-derivation
    const accountProxy = utils.create2Address(
      args.factory,
      utils.hashBytecode(proxyArtifact.bytecode),
      salt,
      encodeAbiParameters(parseAbiParameters("address, bytes"), [args.implementation, "0x"])
    )
    console.log(`Account address: ${accountProxy}`);
    return accountProxy;
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