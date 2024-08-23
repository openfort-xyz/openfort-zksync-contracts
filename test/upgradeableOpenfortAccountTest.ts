import { expect } from "chai"
import { parseAbi } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { eip712WalletActions, getGeneralPaymasterInput, toSinglesigSmartAccount } from "viem/zksync"
import { createWalletClient, createPublicClient, http } from "viem"

//TODO: fixture this shit

const owner = privateKeyToAccount(hre.network.config.accounts[0])
const chain = hre.chain
const openfortAccountAddress = hre.openfortAccountAddress

const publicClient = createPublicClient({
    chain, // custom addition from prepareTest
    transport: http(),
  })

  const walletClient = createWalletClient({
    chain,
    transport: http(hre.network.config.url),
  }).extend(eip712WalletActions())


  // configure viem smart account
  const accountWithOwner = toSinglesigSmartAccount({
    address: openfortAccountAddress, // custom addition from prepareTest
    privateKey: hre.network.config.accounts[0],
  })


describe("ERC20 interactions from Openfort Account", function () {

    const MOCK_ERC20 = "0x0a433954E786712354c5917D0870895c29EF7AE4";


    it("sign with owner: balance should be updated", async function () {
        // Get initial balance

        const initialBalance = await publicClient.readContract({
            account: accountWithOwner,
            address: MOCK_ERC20,
            abi: parseAbi(["function balanceOf(address owner) external view returns (uint256)"]),
            functionName: "balanceOf",
            args: [openfortAccountAddress],
        });

        const amount = BigInt(42)

        console.log(`initial balance ${initialBalance}`)
        // Mint tokens
        const hash = await walletClient.writeContract({
            account: accountWithOwner,
            address: MOCK_ERC20,
            abi: parseAbi(["function mint(address sender, uint256 amount) external"]),
            functionName: "mint",
            args: [openfortAccountAddress, amount],
            paymaster: process.env.SOPHON_TESTNET_PAYMASTER_ADDRESS,
            paymasterInput: getGeneralPaymasterInput({ innerInput: new Uint8Array() }),
        });
        console.log("Transaction Hash:", hash);
        // Get final balance
        const finalBalance = await publicClient.readContract({
            account: accountWithOwner,
            address: MOCK_ERC20,
            abi: parseAbi(["function balanceOf(address owner) external view returns (uint256)"]),
            functionName: "balanceOf",
            args: [openfortAccountAddress],
        });
        console.log(`final balance ${finalBalance}`)
        // Assert that the final balance is the initial balance plus the minted amount
        expect(finalBalance - initialBalance).to.equal(amount);
    });

    it("sign with valid session key: balance should be updated", async function () {
        const blockTimestamp = (await publicClient.getBlock()).timestamp

        const sessionKey = generatePrivateKey()
        const sessionKeyAddress = privateKeyToAccount(sessionKey).address

        console.log(sessionKey)
        const accountWithSessionKey = toSinglesigSmartAccount({
            address: openfortAccountAddress,
            privateKey: sessionKey
          })

        // register a new random sessionKey
        await walletClient.writeContract({
            account: owner,
            address: openfortAccountAddress,
            abi: parseAbi(["function registerSessionKey(address, uint48, uint48, uint48, address[]) external"]),
            functionName: "registerSessionKey",
            args: [sessionKeyAddress, blockTimestamp, blockTimestamp + BigInt(24 * 60 * 60), 100, []],
            paymaster: process.env.SOPHON_TESTNET_PAYMASTER_ADDRESS,
            paymasterInput: getGeneralPaymasterInput({ innerInput: new Uint8Array() }),
        });

        const amount = BigInt(42)

        // sign with the new sessionKey
        await walletClient.writeContract({
            account: accountWithSessionKey,
            address: openfortAccountAddress,
            abi: parseAbi(["function mint(address sender, uint256 amount) external"]),
            functionName: "mint",
            args: [openfortAccountAddress, amount],
            paymaster: process.env.SOPHON_TESTNET_PAYMASTER_ADDRESS,
            paymasterInput: getGeneralPaymasterInput({ innerInput: new Uint8Array() }),
        });


    })

})