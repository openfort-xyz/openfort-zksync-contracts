import { utils, Wallet, Provider } from "zksync-ethers";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

export default async function (hre: HardhatRuntimeEnvironment) {

  // Private key of the account used to deploy
  const wallet = new Wallet("3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e");
  const deployer = new Deployer(hre, wallet);

  // const aaArtifact = await deployer.loadArtifact("UpgradeableOpenfortAccount");
  const factoryArtifact = await deployer.loadArtifact("UpgradeableOpenfortFactory");
  const proxyArtifact = await deployer.loadArtifact("UpgradeableOpenfortProxy");



  // Getting the bytecodeHash of the account
  const bytecodeHash = utils.hashBytecode(proxyArtifact.bytecode);

  console.log(proxyArtifact.bytecode);
  // DEBUG ONLY
  const bytes32String = '0x' + Array.from(bytecodeHash)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  console.log(bytes32String);


  const factory = await deployer.deploy(factoryArtifact, ["0xd986b0cB0D1Ad4CCCF0C4947554003fC0Be548E9", bytecodeHash, "0x9c1a3d7C98dBF89c7f5d167F2219C29c2fe775A7", 100, 10, 10, 200, "0xbc989fde9e54cad2ab4392af6df60f04873a033a"], undefined, [
    // factoryDeps.
    proxyArtifact.bytecode,
  ]);

  const factoryAddress = await factory.getAddress();
  console.log(`AA factory address: ${factoryAddress}`);
  const aaFactory = new ethers.Contract(factoryAddress, factoryArtifact.abi, wallet)
  const owner = Wallet.createRandom();
  console.log("SC Account owner pk: ", owner.privateKey);

  const tx = await aaFactory.createAccountWithNonce(owner.address, "0x1000000000000000000000000000000000000000000000000000000000000000", false);
  await tx.wait()

  console.log(tx);
}
