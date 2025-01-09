import { task } from "hardhat/config"
import { utils } from "zksync-ethers"
import { randomBytes } from "ethers"
import { fromBytes } from "viem"

task("deploy-mocks", "Deploy mock token contracts")
    .addFlag("verify", "Verify the contract code on explorer")
    .addOptionalParam("salt", "Salt for create2 deployment")
    .setAction(async (args, hre) => {
        const mockERC20Artifact = await hre.deployer.loadArtifact("MockERC20");
        const mockERC712Artifact = await hre.deployer.loadArtifact("SimpleNFT");

        const salt = args.salt ?? fromBytes(randomBytes(32), 'hex');

        // Deploy ERC20
        const erc20 = await hre.deployer.deploy(
            mockERC20Artifact,
            [],
            "create2",
            {
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

        // Deploy NFT
        const nft = await hre.deployer.deploy(
            mockERC712Artifact,
            [],
            "create2",
            {
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

        const nftAddress = await nft.getAddress();
        const erc20Address = await erc20.getAddress();

        if (args.verify) {
            await hre.run("verify:verify", {
                address: nftAddress,
                constructorArguments: [],
                contract: `${mockERC712Artifact.sourceName}:${mockERC712Artifact.contractName}`,
                noCompile: true,
            })
            console.log(`MockNFT deployed and verified at ${nftAddress}`);

            await hre.run("verify:verify", {
                address: erc20Address,
                constructorArguments: [],
                contract: `${mockERC20Artifact.sourceName}:${mockERC20Artifact.contractName}`,
                noCompile: true,
            })
            console.log(`MockERC20 deployed and verified at ${erc20Address}`);
        } else {
            console.log(`MockNFT deployed at ${nftAddress}`);
            console.log(`MockERC20 deployed at ${erc20Address}`);
        }
    })