import { randomBytes } from "ethers";
import { task } from "hardhat/config"
import { fromBytes } from "viem";
import { privateKeyToAddress } from "viem/accounts";

task("deploy-paymaster", "Deploy paymaster contract")
    .addFlag("verify", "Verify the contract code on explorer")
    .addOptionalParam("salt", "Salt for create2 deployment")
    .setAction(async (args, hre) => {
        const owner = privateKeyToAddress(hre.network.config.accounts[0]);
        console.log("Owner address", owner);

        const salt = args.salt ?? fromBytes(randomBytes(32), "hex")
        const paymasterArtifact = await hre.deployer.loadArtifact("MultiTokenPaymaster");
        const paymaster = await hre.deployer.deploy(paymasterArtifact, [owner], "create2", salt);
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