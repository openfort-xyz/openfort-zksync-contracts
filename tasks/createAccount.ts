import {
    createWalletClient,
    http,
    parseAbi,
    numberToHex,
    keccak256,
    encodeAbiParameters,
    parseAbiParameters,
    parseEther,
    getAddress,
    slice,
    pad,
    concat,
    Hex,
    fromBytes,
} from "viem";
import { eip712WalletActions, hashBytecode } from "viem/zksync";
import { privateKeyToAccount } from "viem/accounts";
import { task } from "hardhat/config";
import { getViemChainFromConfig, writeContract } from "./utils";

task("create-account", "Create and Initialize an Openfort Upgradeable Account")
    .addParam("factory", "Factory address")
    .addParam("implementation", "Account Implementation address")
    .addParam("nonce", "Number to generate predictive address with CREATE2")
    .setAction(async (args, hre) => {
        const chain = getViemChainFromConfig();
        const walletClient = createWalletClient({
            chain,
            transport: http(hre.network.config.url),
        }).extend(eip712WalletActions());

        const account = privateKeyToAccount(hre.network.config.accounts[0]);
        const nonce = numberToHex(args.nonce, { size: 32 });
        const contractOptions = {
            account,
            address: args.factory,
            abi: parseAbi([
                "function createAccountWithNonce(address _admin, bytes32 _nonce, bool _initializeGuardian) external",
            ]),
            functionName: "createAccountWithNonce",
            args: [account.address, nonce, true],
        };

        await writeContract(walletClient, contractOptions);
        const accountProxy = await hre.run("get-account", {
            factory: args.factory,
            implementation: args.implementation,
            nonce,
        });

        // send enough funds to Openfort smart accounts on zkSyncSepolia or local
        // for the entire end to tend test suite
        // on Sophon use paymaster
        if (chain.name != "Sophon") {
            await walletClient.sendTransaction({
                account,
                to: accountProxy,
                value: parseEther("0.001"),
            });
        }
        return accountProxy;
    });

task("get-account", "Compute zkSync create2 address of an account")
    .addParam("factory", "Factory Address")
    .addParam("implementation", "Account Implementation address")
    .addParam("nonce", "Number to generate predictive address with CREATE2")
    .setAction(async (args, hre) => {
        const account = privateKeyToAccount(hre.network.config.accounts[0]);
        const proxyArtifact = await hre.deployer.loadArtifact("UpgradeableOpenfortProxy");
        const abiTypes = parseAbiParameters("address, bytes32");
        const nonce = numberToHex(args.nonce, { size: 32 });
        // https://docs.zksync.io/build/developer-reference/ethereum-differences/evm-instructions#address-derivation
        const accountProxy = create2Address(
            args.factory,
            fromBytes(hashBytecode(proxyArtifact.bytecode as Hex), "hex"),
            keccak256(encodeAbiParameters(abiTypes, [account.address, nonce])),
            encodeAbiParameters(parseAbiParameters("address, bytes"), [args.implementation, "0x"]),
        );
        console.log(`Account Address: ${accountProxy}`);
        return accountProxy;
    });

function create2Address(sender, bytecodeHash, salt, input) {
    const prefix = "0x2020dba91b30cc0006188af794c2fb30dd8520db7e2c088b7fc7c103c00ca494";
    const inputHash = keccak256(input);
    const concatenatedData = concat([prefix, pad(sender, { size: 32 }), salt, bytecodeHash, inputHash]);
    const addressBytes = slice(keccak256(concatenatedData), 12);
    return getAddress(addressBytes);
}
