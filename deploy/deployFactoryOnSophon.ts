import { utils, Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export default async function (hre: HardhatRuntimeEnvironment) {

    console.log(`Running script on ${hre.network.name} network`);

    // Private key of the account used to deploy
    const wallet = new Wallet(process.env.WALLET_PRIVATE_KEY as string);

    const SOPHON_TESTNET_PAYMASTER_ADDRESS = "0x950e3Bb8C6bab20b56a70550EC037E22032A413e";

    const contractArtifactName = "UpgradeableOpenfortFactory";
    const proxyArtifactName = "UpgradeableOpenfortProxy";

    const factoryArtifact = await hre.deployer.loadArtifact(contractArtifactName);
    const proxyArtifact = await hre.deployer.loadArtifact(proxyArtifactName);

    const RECOVERY_PERIOD = 2 * 24 * 60 * 60; // 2 days in seconds
    const SECURITY_PERIOD = 1.5 * 24 * 60 * 60; // 1.5 days in seconds
    const SECURITY_WINDOW = 0.5 * 24 * 60 * 60; // 0.5 days in seconds
    const LOCK_PERIOD = 5 * 24 * 60 * 60; // 5 days in seconds

    const constructorArguments = [
        wallet.address,
        utils.hashBytecode(proxyArtifact.bytecode),
        process.env.ACCOUNT_IMPLEMENTATION_ADDRESS,
        RECOVERY_PERIOD,
        SECURITY_PERIOD,
        SECURITY_WINDOW,
        LOCK_PERIOD,
        wallet.address,
    ]

    const params = utils.getPaymasterParams(
        SOPHON_TESTNET_PAYMASTER_ADDRESS,
        {
            type: "General",
            innerInput: new Uint8Array(),
        }
    );

    console.log(`Account Factory Owner is ${wallet.address}`);

    const factory = await hre.deployer.deploy(factoryArtifact,
        constructorArguments,
        "create",
        {
            customData: {
                paymasterParams: params,
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
            },
        },
        [proxyArtifact.bytecode],
    );

    const FACTORY_ADDRESS = await factory.getAddress();
    console.log(`AA factory address: ${FACTORY_ADDRESS}`);

    if (!hre.network.name.includes("Node")) {
        const fullContractSource = `${factoryArtifact.sourceName}:${factoryArtifact.contractName}`;
        await hre.run("verify:verify", {
            address: FACTORY_ADDRESS,
            constructorArguments: constructorArguments,
            contract: fullContractSource,
            noCompile: true,
        });
    }
}