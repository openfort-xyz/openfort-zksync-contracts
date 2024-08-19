
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { utils } from "zksync-ethers";

// as well as verify it on Block Explorer if possible for the network
export default async function (hre: HardhatRuntimeEnvironment) {

    console.log(`Running script on ${hre.network.name} network`);

    const SOPHON_TESTNET_PAYMASTER_ADDESS = "0x950e3Bb8C6bab20b56a70550EC037E22032A413e";
    const contractArtifactName = "UpgradeableOpenfortAccount";
    const constructorArguments = [];
    const artifact = await hre.deployer.loadArtifact(contractArtifactName);

    const params = utils.getPaymasterParams(
        SOPHON_TESTNET_PAYMASTER_ADDESS,
        {
            type: "General",
            innerInput: new Uint8Array(),
        }
    );

    const contract = await hre.deployer.deploy(artifact,
        constructorArguments || [],
        "createAccount",
        {
            customData: {
                paymasterParams: params,
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
            },
        });

    const ACCOUNT_ADDRESS = await contract.getAddress();
    console.log(`Account deployed to: ${ACCOUNT_ADDRESS}`);

    if(!hre.network.name.includes("Node")) {
        const fullContractSource = `${artifact.sourceName}:${artifact.contractName}`;
    
        await hre.run("verify:verify", {
          address: ACCOUNT_ADDRESS,
          constructorArguments: [],
          contract: fullContractSource,
          noCompile: true,
        });
      }
}
