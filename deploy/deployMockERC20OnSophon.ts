
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { utils } from "zksync-ethers";

export default async function (hre: HardhatRuntimeEnvironment) {

    console.log(`Running script on ${hre.network.name} network`);

    const SOPHON_TESTNET_PAYMASTER_ADDRESS = "0x950e3Bb8C6bab20b56a70550EC037E22032A413e";
    const contractArtifactName = "MockERC20";
    const constructorArguments = [];
    const artifact = await hre.deployer.loadArtifact(contractArtifactName);

    const params = utils.getPaymasterParams(
        SOPHON_TESTNET_PAYMASTER_ADDRESS,
        {
            type: "General",
            innerInput: new Uint8Array(),
        }
    );

    const contract = await hre.deployer.deploy(artifact,
        constructorArguments,
        "create",
        {
            customData: {
                paymasterParams: params,
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
            },
        });

    const MockERC20 = await contract.getAddress();
    console.log(`MockERC20 deployed to: ${MockERC20}`);

    if (!hre.network.name.includes("Node")) {
        const fullContractSource = `${artifact.sourceName}:${artifact.contractName}`;
        await hre.run("verify:verify", {
            address: MockERC20,
            constructorArguments: [],
            contract: fullContractSource,
            noCompile: true,
        });
    }
}
