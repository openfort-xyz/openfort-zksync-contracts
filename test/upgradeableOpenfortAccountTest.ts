import { expect } from "chai"
import { parseAbi } from "viem"

import { getGeneralPaymasterInput, toSinglesigSmartAccount } from "viem/zksync"

//TODO: fixture this shit
const account = hre.account
const walletClient = hre.walletClient
const publicClient = hre.publicClient

describe("Token interactions from Openfort Account", function () {

    const MOCK_ERC20 = "0x0a433954E786712354c5917D0870895c29EF7AE4";

    it("mint with owner: balance should be updated", async function () {
        // Get initial balance
        const initialBalance = await publicClient.readContract({
            account,
            address: MOCK_ERC20,
            abi: parseAbi(["function balanceOf(address owner) external view returns (uint256)"]),
            functionName: "balanceOf",
            args: [account.address],
        });

        console.log(`initial balance ${initialBalance}`)
    
        // Mint tokens
        const hash = await walletClient.writeContract({
            account,
            address: MOCK_ERC20,
            abi: parseAbi(["function mint(address sender, uint256 amount) external"]),
            functionName: "mint",
            args: [account.address, BigInt(42)],
            paymaster: process.env.SOPHON_TESTNET_PAYMASTER_ADDRESS,
            paymasterInput: getGeneralPaymasterInput({ innerInput: new Uint8Array() }),
        });
        console.log("Transaction Hash:", hash);
    
        // Get final balance
        const finalBalance = await publicClient.readContract({
            account,
            address: MOCK_ERC20,
            abi: parseAbi(["function balanceOf(address owner) external view returns (uint256)"]),
            functionName: "balanceOf",
            args: [account.address],
        });
    
        console.log(`final balance ${finalBalance}`)
        // Assert that the final balance is the initial balance plus the minted amount
        const mintedAmount = BigInt(42);
        expect(finalBalance - initialBalance).to.equal(mintedAmount);
    });
})