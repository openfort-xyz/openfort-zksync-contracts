import { createWalletClient, http, parseAbi, numberToHex, keccak256, encodeAbiParameters, parseAbiParameters, parseEther } from "viem"
import { eip712WalletActions } from "viem/zksync"
import { privateKeyToAccount } from "viem/accounts"
import { utils } from "zksync-ethers"
import { task } from "hardhat/config"
import { getViemChainFromConfig, writeContract } from "./utils"


task("create-account", "Create and Initialize an Openfort Upgradeable Account")
  .addParam("factory", "Factory address")
  .addParam("implementation", "Account Implementation address")
  .addParam("nonce", "Number to generate predictive address with CREATE2")
  .setAction(async (args, hre) => {
    const chain = getViemChainFromConfig()
    const walletClient = createWalletClient({
      chain,
      transport: http(hre.network.config.url),
    }).extend(eip712WalletActions())

    const account = privateKeyToAccount(hre.network.config.accounts[0])
    const nonce = numberToHex(args.nonce, {size: 32})
    const contractOptions = {
      account,
      address: args.factory,
      abi: parseAbi(["function createAccountWithNonce(address _admin, bytes32 _nonce, bool _initializeGuardian) external"]),
      functionName: "createAccountWithNonce",
      args: [account.address, nonce, true],
    }

    await writeContract(walletClient, contractOptions)
    const accountProxy = await hre.run("get-account", { factory: args.factory, implementation: args.implementation, nonce })

    // send enough funds to Openfort smart accounts on zkSyncSepolia or local
    // for the entire end to tend test suite
    // on Sophon use paymaster
    if (chain.name != "Sophon" ) {
        // no need to await here -- funds will be on the account on-time
        walletClient.sendTransaction({
            account,
            to: accountProxy,
            value: parseEther("0.001"),
        })
    }
    return accountProxy
  })


task("get-account", "Compute zkSync create2 address of an account")
  .addParam("factory", "Factory Address")
  .addParam("implementation", "Account Implementation address")
  .addParam("nonce", "Number to generate predictive address with CREATE2")
  .setAction(async (args, hre) => {
    const account = privateKeyToAccount(hre.network.config.accounts[0])
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