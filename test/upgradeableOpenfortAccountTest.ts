import { expect } from "chai"
import { Hex, parseAbi } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { eip712WalletActions, toSinglesigSmartAccount } from "viem/zksync"
import { createWalletClient, createPublicClient, hashTypedData, http } from "viem"
import { getViemChainFromConfig, writeContract } from "../tasks/utils"
import { getGeneralPaymasterInput, serializeTransaction } from "viem/zksync"


// Global test config
const owner = privateKeyToAccount(hre.network.config.accounts[0])
const chain = getViemChainFromConfig()
const openfortAccountAddress = hre.openfortAccountAddress

const publicClient = createPublicClient({
    chain,
    transport: http(),
  })


// configure viem smart account
const accountWithOwner = toSinglesigSmartAccount({
    address: openfortAccountAddress,
    privateKey: hre.network.config.accounts[0],
  })

const walletClient = createWalletClient({
    account: accountWithOwner,
    chain,
    transport: http(hre.network.config.url),
  }).extend(eip712WalletActions())



describe("ERC20 interactions from Openfort Account", function () {
    const MOCK_ERC20_ON_SOPHON = "0x0a433954E786712354c5917D0870895c29EF7AE4";
    interface Tokens {
        mockERC20: `0x${string}`;
    }
    const tokens: Tokens = {
        mockERC20: MOCK_ERC20_ON_SOPHON
    };

    async function deployTokens() {
        // use already whitelisted mocks on Sophon
        // deploy token contracts only once for all tests on other chains
        if (chain.name != "Sophon" && tokens.mockERC20 == MOCK_ERC20_ON_SOPHON) {
            const artifact = await hre.deployer.loadArtifact("MockERC20");
            const contract = await hre.deployer.deploy(artifact, [], "create")
            tokens.mockERC20 = await contract.getAddress()
            console.log(`MockERC20 deployed to ${tokens.mockERC20}`)
        }
    }

    it("self-custody account flow: sign raw transaction", async function () {
        const paymaster = {
            paymaster: process.env.SOPHON_TESTNET_PAYMASTER_ADDRESS as `0x${string}`,
            paymasterInput: getGeneralPaymasterInput({ innerInput: new Uint8Array() }),
        };

        const transactionRequest = await walletClient.prepareTransactionRequest({
            account: accountWithOwner,
            from: accountWithOwner.address,
            chainId: chain.id,
            // MOCK ERC20 sophon contract
            to: "0x0a433954E786712354c5917D0870895c29EF7AE4",
            // function mint(address sender = 0x9590Ed0C18190a310f4e93CAccc4CC17270bED40, unit256 amount = 42)
            data: "0x40c10f190000000000000000000000009590ed0c18190a310f4e93caccc4cc17270bed40000000000000000000000000000000000000000000000000000000000000002a",
            ...paymaster,
        });

        const signableTransaction = {
            from: accountWithOwner.address,
            chainId: chain.id,
            // preparedTransactionRequest
            nonce: transactionRequest.nonce,
            gas: transactionRequest.gas,
            maxFeePerGas: transactionRequest.maxFeePerGas,
            maxPriorityFeePerGas: transactionRequest.maxPriorityFeePerGas,

            to: "0x0a433954E786712354c5917D0870895c29EF7AE4" as Hex,
            data: "0x40c10f190000000000000000000000009590ed0c18190a310f4e93caccc4cc17270bed40000000000000000000000000000000000000000000000000000000000000002a" as Hex,
            ...paymaster,
        };

        // OPENFORT FLOW:
        // for self-custody accounts: Openfort needs to return a serialized signable hash from a transaction intent
        // User would sign it then call the `signature` endpoint to broadcast through `sendRawTranscatoin`

        const EIP712hash = hashTypedData(chain.custom.getEip712Domain(signableTransaction))
        const signature = await accountWithOwner.sign({hash: EIP712hash})

        const signedTransaction = serializeTransaction({
            ...signableTransaction,
            customSignature: signature,
        });
        const hash = await publicClient.sendRawTransaction({
            serializedTransaction: signedTransaction,
        })
        console.log(`Send Raw Transaction Hash : ${hash}`)
    });


    it("sign with owner: balance should be updated", async function () {
        await deployTokens()

        const initialBalance = await publicClient.readContract({
            account: accountWithOwner,
            address: tokens.mockERC20,
            abi: parseAbi(["function balanceOf(address owner) external view returns (uint256)"]),
            functionName: "balanceOf",
            args: [openfortAccountAddress],
        });

        const amount = BigInt(42)
        // Mint tokens
        await writeContract(walletClient, {
            account: accountWithOwner,
            address: tokens.mockERC20!,
            abi: parseAbi(["function mint(address sender, uint256 amount) external"]),
            functionName: "mint",
            args: [openfortAccountAddress, amount]
        })
        // Get final balance
        const finalBalance = await publicClient.readContract({
            account: accountWithOwner,
            address: tokens.mockERC20,
            abi: parseAbi(["function balanceOf(address owner) external view returns (uint256)"]),
            functionName: "balanceOf",
            args: [openfortAccountAddress],
        });

        // Assert that the final balance is the initial balance plus the minted amount
        expect(finalBalance - initialBalance).to.equal(amount);
    });

    it("register a valid session key and sign with it: balance should be updated", async function () {

        await deployTokens()
        const blockTimestamp = (await publicClient.getBlock()).timestamp

        // generate a new private key
        // to avoid Account contract reverts with "SessionKey already registered"

        const sessionKey = generatePrivateKey()
        const sessionKeyAddress = privateKeyToAccount(sessionKey).address

        // setup openfort smart account with session key as signer
        const accountWithSessionKey = toSinglesigSmartAccount({
            address: openfortAccountAddress,
            privateKey: sessionKey
          })

        // register a new random sessionKey
        await writeContract(walletClient, {
            account: owner,
            address: openfortAccountAddress,
            abi: parseAbi(["function registerSessionKey(address, uint48, uint48, uint48, address[]) external"]),
            functionName: "registerSessionKey",
            // Session Key is valid for 24 hours
            args: [sessionKeyAddress, blockTimestamp, blockTimestamp + BigInt(24 * 60 * 60), 100, []],
        })

        // sign with the new sessionKey
        const amount = BigInt(42)

        const hash = await writeContract(walletClient,{
            account: accountWithSessionKey,
            address: tokens.mockERC20,
            abi: parseAbi(["function mint(address sender, uint256 amount) external"]),
            functionName: "mint",
            args: [openfortAccountAddress, amount],
        })
        console.log(`Sign With Session Key Tansaction Hash ${hash}`)
    })
})