import { expect } from "chai";
import { createPublicClient, http, parseAbi, Address, Hex, Hash, encodePacked, keccak256, concat, recoverAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getViemChainFromConfig } from "../tasks/utils";
import hre from "hardhat";


const paymasterOwner = privateKeyToAccount(hre.network.config.accounts[0])
const chain = getViemChainFromConfig()

export type PaymasterInputData = {
    selector: Hex;
    from: Address;
    to: Address;
    data: Hash;
    value?: bigint;
    maxFeePerGas: bigint;
    gasLimit: bigint;
};

export async function getZKSyncPaymasterInputData(paymasterInputData: PaymasterInputData): Promise<Hex> {
    const encodedData = encodePacked(
        ["address", "address", "bytes", "uint256", "uint256", "uint256"],
        [
            paymasterInputData.from,
            paymasterInputData.to,
            paymasterInputData.data,
            paymasterInputData.value ?? 0n,
            paymasterInputData.maxFeePerGas,
            paymasterInputData.gasLimit,
        ],
    );

    const hash = keccak256(encodedData, "bytes");
    const signature = await paymasterOwner.signMessage({ message: { raw: hash } });
    return concat([paymasterInputData.selector, signature]);
}

describe("Paymaster", function () {
  it("should validate the paymaster signature correctly", async function () {

    // Create a public client
    const publicClient = createPublicClient({
      chain,
      transport: http()
    });

    // Deploy the paymaster
    const paymasterArtifact = await hre.deployer.loadArtifact("GeneralPaymaster");
    const paymaster = await hre.deployer.deploy(paymasterArtifact, [paymasterOwner.address], "create");
    const paymasterAddress = await paymaster.getAddress();


    // Prepare sample input data
    const sampleInputData: PaymasterInputData = {
      selector: "0x8c5a3445", // getGeneralPaymasterInput({ innerInput: new Uint8Array() }).slice(0,10) as Hex,
      from: "0x1234567890123456789012345678901234567890" as Address,
      to: "0x0987654321098765432109876543210987654321" as Address,
      data: "0xabcdef1234567890" as Hex,
      value: 1000000000000000000n, // 1 ETH
      maxFeePerGas: 100000000000n, // 100 Gwei
      gasLimit: 100000n,
    };

    // Generate paymaster input data
    const signature = "0x" + (await getZKSyncPaymasterInputData(sampleInputData)).slice(10) as Hex;
    // Define the ABI for the _isValidSignature function
    const abi = parseAbi([
      "function isValidSignature(bytes memory, address, address, bytes calldata, uint256, uint256, uint256) public view returns (bool)"
    ]);

    // Call the _isValidSignature function
    const isValid = await publicClient.readContract({
      address: paymasterAddress as Address,
      abi,
      functionName: "isValidSignature",
      args: [signature, sampleInputData.from, sampleInputData.to, sampleInputData.data, sampleInputData.value ?? 0n, sampleInputData.maxFeePerGas, sampleInputData.gasLimit]
    });

    // Assert that the signature is valid
    expect(isValid).to.be.true;

    // Test with an invalid signature
    const invalidSignature = "0x1234567890" as Hex;
    
    // Call the _isValidSignature function
    const isInvalid = await publicClient.readContract({
            address: paymasterAddress as Address,
            abi,
            functionName: "isValidSignature",
            args: [ invalidSignature, sampleInputData.from, sampleInputData.to, sampleInputData.data, sampleInputData.value ?? 0n, sampleInputData.maxFeePerGas, sampleInputData.gasLimit]
          });

    // Assert that the invalid signature is rejected
    expect(isInvalid).to.be.false;
  });
});
