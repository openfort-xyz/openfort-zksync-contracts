import { task } from "hardhat/config"
import { privateKeyToAddress } from "viem/accounts";

task("deploy-paymaster", "Deploy paymaster contract")
    .addFlag("verify", "Verify the contract code on explorer")
    .setAction(async (args, hre) => {
        
        const owner = privateKeyToAddress(hre.network.config.accounts[0]);
        console.log("Owner address", owner);
        const paymasterArtifact = await hre.deployer.loadArtifact("GeneralPaymaster");
        const paymaster = await hre.deployer.deploy(paymasterArtifact, [owner], "create");
        const paymasterAddress = await paymaster.getAddress();

        if (args.verify) {
            await hre.run("verify:verify", {
                address: paymasterAddress,
                constructorArguments: [owner],
                contract: `${paymasterArtifact.sourceName}:${paymasterArtifact.contractName}`,
                noCompile: true,
            })
        }
        console.log(`Paymaster deployed at ${paymasterAddress}`);
    })