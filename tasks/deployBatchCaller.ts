import { task } from "hardhat/config"
import { utils } from "zksync-ethers"
import { randomBytes } from "ethers"
import { fromBytes } from "viem"


task("deploy-batchcaller", "Deploy batchcaller contract")
    .addFlag("verify", "Verify the contract code on explorer")
    .addOptionalParam("salt", "Salt for create2 deployment")
    .setAction(async (args, hre) => {
        const batchCallerArtifact = await hre.deployer.loadArtifact("BatchCaller");
        const salt = args.salt ?? fromBytes(randomBytes(32), 'hex');
        const batchCaller = await hre.deployer.deploy(
            batchCallerArtifact, 
            [], 
            "create2",
            {
                // fill paymaster params for sophon, leave empty .
                customData: !hre.network.config.url.includes("sophon") ? {salt} : {
                    salt,
                    paymasterParams: utils.getPaymasterParams(
                        process.env.SOPHON_PAYMASTER_ADDRESS!,
                        {
                            type: "General",
                            innerInput: new Uint8Array(),
                        }),
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                },
            },
        );

        const batchCallerAddress = await batchCaller.getAddress();
        
        if (args.verify) {
            await hre.run("verify:verify", {
                address: batchCallerAddress,
                constructorArguments: [],
                contract: `${batchCallerArtifact.sourceName}:${batchCallerArtifact.contractName}`,
                noCompile: true,
            })
        }
        console.log(`batchCaller deployed at ${batchCallerAddress}`);
    })