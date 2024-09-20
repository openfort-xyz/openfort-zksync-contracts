import { utils } from "zksync-ethers"
import { task } from "hardhat/config"
import { randomBytes } from "ethers";

task("deploy-account", "Deploy an Openfort Upgradeable Account")
    .addFlag("verify", "Verify the contract code on explorer")
    .addOptionalParam("salt", "Salt for create2 deployment", "0x0000000000000000000000000000000000000000000000000000000000000042")
    .setAction(async (args, hre) => {
        const contractArtifactName = "UpgradeableOpenfortAccount";
        const constructorArguments = [];
        const artifact = await hre.deployer.loadArtifact(contractArtifactName);

        const salt = args.salt ?? randomBytes(32);;

        const contract = await hre.deployer.deploy(artifact,
            constructorArguments,
            "create2Account",
            {
                customData: hre.network.config.url.includes("sophon") ? {
                    salt,
                    paymasterParams: utils.getPaymasterParams(
                        process.env.SOPHON_TESTNET_PAYMASTER_ADDRESS!,
                        {
                            type: "General",
                            innerInput: new Uint8Array(),
                        }),
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                } : {
                    salt,
                }
            });
        const ACCOUNT_ADDRESS = await contract.getAddress();
        console.log(`Account deployed to: ${ACCOUNT_ADDRESS}`);
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
