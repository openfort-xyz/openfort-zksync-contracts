import { utils, Wallet } from "zksync-ethers"
import { task } from "hardhat/config"
import { randomBytes } from "ethers"
import { fromBytes } from "viem/utils"
import { hashBytecode } from "zksync-ethers/build/utils"
import { Hex } from "viem"

task("deploy-factory", "Deploy an Openfort Factory")
    .addFlag("verify", "Verify the contract code on explorer")
    .addOptionalParam("account", "The account implementation address")
    .addOptionalParam("salt", "Salt for create2 deployment")
    .setAction(async (args, hre) => {
        const contractArtifactName = "UpgradeableOpenfortFactory"
        const proxyArtifactName = "UpgradeableOpenfortProxy"
        const factoryArtifact = await hre.deployer.loadArtifact(contractArtifactName)
        const proxyArtifact = await hre.deployer.loadArtifact(proxyArtifactName)

        const wallet = new Wallet(hre.network.config.accounts[0])

        const RECOVERY_PERIOD = 2 * 24 * 60 * 60 // 2 days in seconds
        const SECURITY_PERIOD = 1.5 * 24 * 60 * 60 // 1.5 days in seconds
        const SECURITY_WINDOW = 0.5 * 24 * 60 * 60 // 0.5 days in seconds
        const LOCK_PERIOD = 5 * 24 * 60 * 60 // 5 days in seconds

        if (!args.account) {
            args.account = await hre.run("deploy-account", { verify: args.verify })
        }

        const proxyBytecodeHash = hashBytecode(proxyArtifact.bytecode as Hex)
        const constructorArguments = [
            wallet.address,
            proxyBytecodeHash,
            args.account,
            RECOVERY_PERIOD,
            SECURITY_PERIOD,
            SECURITY_WINDOW,
            LOCK_PERIOD,
            wallet.address,
        ]

        const salt = args.salt ?? fromBytes(randomBytes(32), "hex")

        const contract = await hre.deployer.deploy(factoryArtifact,
            constructorArguments,
            "create2",
            {
                customData: !hre.network.config.url.includes("sophon") ? { salt } : {
                    salt,
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
        )

        const FACTORY_ADDRESS = await contract.getAddress()
        console.log(`Factory deployed to: ${FACTORY_ADDRESS}`)
        if (args.verify) {
            const fullContractSource = `${factoryArtifact.sourceName}:${factoryArtifact.contractName}`
            try {
                await hre.run("verify:verify", {
                    address: FACTORY_ADDRESS,
                    constructorArguments: [],
                    contract: fullContractSource,
                    noCompile: true,
                })
            } catch (e) {
                console.log(e)
            }
        }
        return {
            factory: FACTORY_ADDRESS,
            implementation: args.account,
        }
    })