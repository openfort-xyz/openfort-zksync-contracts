import { Address, PublicClient, WalletClient } from "viem"
import { getGeneralPaymasterInput, zksyncInMemoryNode, zksyncSepoliaTestnet } from "viem/zksync"
import { sophon, sophonTestnet } from "viem/chains"

export async function writeContract(c: WalletClient, contractParams) {
  // add paymaster info for sophon
  if (hre.network.config.url.includes("sophon")) {
    contractParams.paymaster = process.env.SOPHON_PAYMASTER_ADDRESS
    contractParams.paymasterInput = getGeneralPaymasterInput({ innerInput: new Uint8Array() })
  }
  return c.writeContract(contractParams)
}

export function getViemChainFromConfig() {
  switch (hre.network.config.url) {
    case "http://127.0.0.1:8011":
      return zksyncInMemoryNode
    case "https://sepolia.era.zksync.dev":
      return zksyncSepoliaTestnet
    case "https://rpc.testnet.sophon.xyz":
      return sophonTestnet
    case "https://rpc.sophon.xyz":
      return sophon
    default:
      throw new Error("Unkown network")
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getEIP712Domain(contractAddress: Address, client: PublicClient) {
  const abi = [
    {
      "constant": true,
      "inputs": [],
      "name": "eip712Domain",
      "outputs": [
        { "name": "fields", "type": "bytes1" },
        { "name": "name", "type": "string" },
        { "name": "version", "type": "string" },
        { "name": "chainId", "type": "uint256" },
        { "name": "verifyingContract", "type": "address" },
        { "name": "salt", "type": "bytes32" },
        { "name": "extensions", "type": "uint256[]" }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    }
  ];

  try {
    const result = await client.readContract({
      address: contractAddress,
      abi: abi,
      functionName: "eip712Domain",
    });
    return result;
  } catch (error) {
    console.error("Error calling eip712Domain:", error);
  }
}
