import { utils, Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { task } from "hardhat/config"

task("deploy-factory", "Deploy an Openfort Factory")
    .addFlag("verify", "Verify the contract code on explorer")
    .addOptionalParam("account", "The account implementation address")
    .setAction(async (args, hre) => {
        const contractArtifactName = "UpgradeableOpenfortFactory";
        const proxyArtifactName = "UpgradeableOpenfortProxy";
        const factoryArtifact = await hre.deployer.loadArtifact(contractArtifactName);
        const proxyArtifact = await hre.deployer.loadArtifact(proxyArtifactName);

        // Private key of the account used to deploy
        const wallet = new Wallet(hre.network.config.accounts[0]);

        const RECOVERY_PERIOD = 2 * 24 * 60 * 60; // 2 days in seconds
        const SECURITY_PERIOD = 1.5 * 24 * 60 * 60; // 1.5 days in seconds
        const SECURITY_WINDOW = 0.5 * 24 * 60 * 60; // 0.5 days in seconds
        const LOCK_PERIOD = 5 * 24 * 60 * 60; // 5 days in seconds

        if (!args.account) {
            args.account = await hre.run("deploy-account", { verify: args.verify })
        }

        const constructorArguments = [
            wallet.address,
            utils.hashBytecode(proxyArtifact.bytecode),
            args.account,
            RECOVERY_PERIOD,
            SECURITY_PERIOD,
            SECURITY_WINDOW,
            LOCK_PERIOD,
            wallet.address,
        ]

        const contract = await hre.deployer.deploy(factoryArtifact,
            constructorArguments,
            "create",
            {
                // fill paymaster params for sophon, leave empty otherwise
                customData: !hre.network.config.url.includes("sophon") ? {} : {
                    paymasterParams: utils.getPaymasterParams(
                        process.env.SOPHON_TESTNET_PAYMASTER_ADDRESS!,
                        {
                            type: "General",
                            innerInput: new Uint8Array(),
                        }),
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                },
            },
            [proxyArtifact.bytecode]
        );

        const FACTORY_ADDRESS = await contract.getAddress();
        console.log(`Factory deployed to: ${FACTORY_ADDRESS}`);
        if (args.verify) {
            const fullContractSource = `${factoryArtifact.sourceName}:${factoryArtifact.contractName}`;
            // verification of implementation contract always fail
            // because it has already been verified
            // on failure: print error and do nothing
            // don't do that in production code, only in test setup
            try {
                await hre.run("verify:verify", {
                    address: FACTORY_ADDRESS,
                    constructorArguments: [],
                    contract: fullContractSource,
                    noCompile: true,
                });
            } catch (e) {
                console.log(e)
            }
        }
        return {
            factory: FACTORY_ADDRESS,
            implementation: args.account
        }
    });