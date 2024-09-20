import { expect } from "chai";
import { createPublicClient, http, parseAbi, Address, Hex, Hash, encodePacked, keccak256, concat} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getViemChainFromConfig } from "../tasks/utils";
import hre from "hardhat";


const paymasterOwner = privateKeyToAccount(hre.network.config.accounts[0])
const chain = getViemChainFromConfig()
const publicClient = createPublicClient({
  chain,
  transport: http()
});

export type PaymasterInputData = {
  from: Address;
  to: Address;
  data: Hash;
  value?: bigint;
  maxFeePerGas: bigint;
  gasLimit: bigint;
};

export const GENERAL_PAYMASTER_SELECTOR = "0x8c5a3445";

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
  return concat([GENERAL_PAYMASTER_SELECTOR, signature]);
}

describe("Paymaster", function () {
  it("should validate the paymaster signature correctly", async function () {
    // Deploy the paymaster
    const paymasterArtifact = await hre.deployer.loadArtifact("GeneralPaymaster");
    const paymaster = await hre.deployer.deploy(paymasterArtifact, [paymasterOwner.address], "create");
    const paymasterAddress = await paymaster.getAddress();


    // Prepare sample input data
    const sampleInputData: PaymasterInputData = {
      from: "0x9590Ed0C18190a310f4e93CAccc4CC17270bED40",
      to: "0x6D62c01040B51405acdF9C32577ca91FB64B8727",
      data: "0x5b31f150000000000000000000000000a12142d1f098ec56860927977d5695cd6b79f96780e9d356ed5647c15ae7b8509522ba5ba4af1bc1bfb5df741f1dcb73656ed0d00000000000000000000000000000000000000000000000000000000000000000",
      maxFeePerGas: 46037767n,
      gasLimit: 2219764n,
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
      args: [invalidSignature, sampleInputData.from, sampleInputData.to, sampleInputData.data, sampleInputData.value ?? 0n, sampleInputData.maxFeePerGas, sampleInputData.gasLimit]
    });

    // Assert that the invalid signature is rejected
    expect(isInvalid).to.be.false;
  });
});
