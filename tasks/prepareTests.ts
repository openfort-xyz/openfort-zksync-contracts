import { task } from "hardhat/config"
import { getViemChainFromConfig, sleep } from "./utils"

task("test")
  .addFlag("skipDeployments", "Requires ACCOUNT_ADDRESS env var")
  .addOptionalParam("nonce", "Number to generate predictive account address with CREATE2")
  .setAction(async (args, hre, runSuper) => {

    let accountAddress = process.env.ACCOUNT_ADDRESS
    let factoryAddress = process.env.FACTORY_ADDRESS
    const chain = getViemChainFromConfig()

    if (!args.skipDeployments) {
      const {factory, implementation} = await hre.run("deploy-factory")
      // wait for sophon backend service to whitelist the factory in their paymaster
      factoryAddress = factory
      if (chain.name == "Sophon") await sleep(30000)
      accountAddress = await hre.run("create-account", { factory, implementation, nonce: args.nonce })
      // wait for sophon backend service to whitelist the new account in their paymaster
      if (chain.name == "Sophon") await sleep(30000)
    }
    hre.openfortAccountAddress = accountAddress
    hre.factoryAddress = factoryAddress
    return runSuper()
  })