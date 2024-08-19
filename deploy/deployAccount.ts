
import { HardhatRuntimeEnvironment } from "hardhat/types";

// as well as verify it on Block Explorer if possible for the network
export default async function (hre: HardhatRuntimeEnvironment) {

  console.log(`Running script on ${hre.network.name} network`);

  const contractArtifactName = "UpgradeableOpenfortAccount";
  const constructorArguments = [];

  const artifact = await hre.deployer.loadArtifact(contractArtifactName);
  const contract = await hre.deployer.deploy(artifact, constructorArguments, "createAccount");

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
