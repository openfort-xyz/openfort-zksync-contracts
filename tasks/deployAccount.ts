import { utils } from "zksync-ethers";
import { task } from "hardhat/config";
import { randomBytes } from "ethers";
import { fromBytes } from "viem";

task("deploy-account", "Deploy an Openfort Upgradeable Account")
    .addFlag("verify", "Verify the contract code on explorer")
    .addOptionalParam("salt", "Salt for create2 deployment")
    .setAction(async (args, hre) => {
        const contractArtifactName = "UpgradeableOpenfortAccount";
        const constructorArguments = [];
        const artifact = await hre.deployer.loadArtifact(contractArtifactName);

        const salt = args.salt ?? fromBytes(randomBytes(32), "hex");

        const contract = await hre.deployer.deploy(artifact, constructorArguments, "create2Account", {
            customData: hre.network.config.url.includes("sophon")
                ? {
                      salt,
                      paymasterParams: utils.getPaymasterParams(process.env.SOPHON_PAYMASTER_ADDRESS!, {
                          type: "General",
                          innerInput: new Uint8Array(),
                      }),
                      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                  }
                : {
                      salt,
                  },
        });
        const ACCOUNT_ADDRESS = await contract.getAddress();
        console.log(`Account implementation deployed to: ${ACCOUNT_ADDRESS}`);
        if (args.verify) {
            const fullContractSource = `${artifact.sourceName}:${artifact.contractName}`;
            await hre.run("verify:verify", {
                address: ACCOUNT_ADDRESS,
                constructorArguments: [],
                contract: fullContractSource,
                noCompile: true,
            });
        }
        return ACCOUNT_ADDRESS;
    });
