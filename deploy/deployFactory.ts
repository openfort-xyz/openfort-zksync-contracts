import { utils, Wallet, Provider } from "zksync-ethers";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

export default async function (hre: HardhatRuntimeEnvironment) {

  // Private key of the account used to deploy
  const wallet = new Wallet("3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e");
  const deployer = new Deployer(hre, wallet);

  const aaArtifact = await deployer.loadArtifact("UpgradeableOpenfortAccount");
  const factoryArtifact = await deployer.loadArtifact("UpgradeableOpenfortFactory");
  const proxyArtifact = await deployer.loadArtifact("UpgradeableOpenfortProxy");



  const aa = await deployer.deploy(aaArtifact);
  const accountAddress = await  aa.getAddress()
  console.log(`New account address ${accountAddress}`);

  // Getting the bytecodeHash of the account
  const bytecodeHash = utils.hashBytecode(proxyArtifact.bytecode);

  //console.log(proxyArtifact.bytecode);
  // DEBUG ONLY
  const bytes32String = '0x' + Array.from(bytecodeHash)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');


  console.log(`account proxy bytecode hash ${bytes32String}`);


  const factory = await deployer.deploy(factoryArtifact, [
    "0xBC989fDe9e54cAd2aB4392Af6dF60f04873A033A",
    bytecodeHash,
    accountAddress,
    100, 10, 10, 200,
    "0xbc989fde9e54cad2ab4392af6df60f04873a033a"],
    "create",
    undefined,
    [proxyArtifact.bytecode,]
  );

  const factoryAddress = await factory.getAddress();
  console.log(`AA factory address: ${factoryAddress}`);
  const owner = Wallet.createRandom();
  const tx = await factory.createAccountWithNonce(owner.address, ethers.ZeroHash, false);
  await tx.wait()

  console.log(tx);
}
