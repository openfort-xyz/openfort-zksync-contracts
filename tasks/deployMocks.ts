import { task } from "hardhat/config"

task("deploy-mocks", "Deploy mock token contracts")
    .setAction(async (args, hre) => {
        const mockERC20Artifact = await hre.deployer.loadArtifact("MockERC20");
        const mockERC712Artifact = await hre.deployer.loadArtifact("SimpleNFT");

        const erc20 = await hre.deployer.deploy(mockERC20Artifact, [], "create");
        const nft = await hre.deployer.deploy(mockERC712Artifact, [], "create");

        const nftAddress = await nft.getAddress();
        const erc20Address = await erc20.getAddress();

        await hre.run("verify:verify", {
            address: nftAddress,
            constructorArguments: [],
            contract: `${mockERC712Artifact.sourceName}:${mockERC712Artifact.contractName}`,
            noCompile: true,
        })

        console.log(`MockNFT deployed and verified at ${nftAddress}`)

        await hre.run("verify:verify", {
            address: erc20Address,
            constructorArguments: [],
            contract: `${mockERC20Artifact.sourceName}:${mockERC20Artifact.contractName}`,
            noCompile: true,
        })

        console.log(`MockERC20 deployed and verified at ${erc20Address}`)
    })