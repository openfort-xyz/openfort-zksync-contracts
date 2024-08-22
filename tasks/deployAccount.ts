import { utils } from "zksync-ethers"

import { task } from "hardhat/config"

task("deploy-account", "Deploy an Openfort Upgradeable Account")
    .addFlag("verify", "Verify the contract code on explorer",)
    .setAction(async (args, hre) => {
        const contractArtifactName = "UpgradeableOpenfortAccount";
        const constructorArguments = [];
        const artifact = await hre.deployer.loadArtifact(contractArtifactName);
        const contract = await hre.deployer.deploy(artifact,
            constructorArguments,
            "createAccount",
            {
                customData: hre.network.config.url.includes("sophon") ? {
                    paymasterParams: utils.getPaymasterParams(
                        process.env.SOPHON_TESTNET_PAYMASTER_ADDRESS!,
                        {
                            type: "General",
                            innerInput: new Uint8Array(),
                        }),
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                } : {}
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
