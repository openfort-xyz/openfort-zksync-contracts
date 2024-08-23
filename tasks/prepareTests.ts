import { task } from "hardhat/config"
import { getViemChainFromConfig, sleep } from "./utils"

task("test")
  .addFlag("skipDeployments", "Requires ACCOUNT_IMPLEMENTATION_ADDRESS env var")
  .addOptionalParam("accountNonce", "Number to generate predictive address with CREATE2")
  .setAction(async (args, hre, runSuper) => {

    let address = process.env.ACCOUNT_IMPLEMENTATION_ADDRESS
    const chain = getViemChainFromConfig()

    if (!args.skipDeployments) {
      const {factory, implementation} = await hre.run("deploy-factory")
      // wait for sophon backend service to whitelist the factory in their paymaster
      if (chain.name == "Sophon") await sleep(60000)
      address = await hre.run("create-account", { factory, implementation, nonce: args.accountNonce })
    }
    hre.openfortAccountAddress = address
    return runSuper()
  })