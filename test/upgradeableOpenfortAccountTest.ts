import { expect } from "chai"

import { buildTransactionRequest, getViemChainFromConfig } from "../tasks/utils"
import { SmartAccount, Provider, types, utils } from "zksync-ethers"

import { generatePrivateKey } from "viem/accounts"
import { createPublicClient, http } from "viem"

import { Interface } from "ethers"
import { ethers } from "ethers"
import { privateKeyToAccount } from "viem/accounts"



// ========================== TEST GLOBAL CONFIGURATION ======================================================


const chain = getViemChainFromConfig()
const openfortAccountAddress = hre.openfortAccountAddress
const publicClient = createPublicClient({
    chain, // custom addition from prepareTest
    transport: http(),
})

const mockERC20Abi = [
    "function mint(address, uint256)"
]
const mockERC20Interface = new Interface(mockERC20Abi)
const baseOpenfortAccountAbi = [
    "function registerSessionKey(address, uint48, uint48, uint48, address[])"
]
const baseOpenfortAccountInterface = new Interface(baseOpenfortAccountAbi)
const privateKey = hre.network.config.accounts[0]
const provider = Provider.getDefaultProvider(types.Network.EraTestNode)
const ownerSigner = new ethers.Wallet(privateKey, provider);
const ownerSmartAccount = new SmartAccount({ address: openfortAccountAddress, secret: privateKey }, provider)



// ========================== TEST HELPER ====================================================================

const ONE_DAY = BigInt(24 * 60 * 60)

interface sessionKey {
    secret: `0x${string}`
    address: `0x${string}`
    isMaster: Boolean
}


async function registerRandomSessionKey(limit: bigint, duration: bigint, whitelist = []): Promise<sessionKey> {


    const blockTimestamp = (await publicClient.getBlock()).timestamp
    const secret = generatePrivateKey()
    const address = privateKeyToAccount(secret).address

    console.log(`session key address ${address}`)

    const registerSessionKeyData = baseOpenfortAccountInterface.encodeFunctionData("registerSessionKey", [
        address,
        blockTimestamp,
        blockTimestamp + duration,
        limit,
        whitelist
    ])

    const params = {
        to: openfortAccountAddress,
        data: registerSessionKeyData,
    }

    const txRequest = buildTransactionRequest(params)
    const populatedRegisterSessionKeyTx = await ownerSigner.populateTransaction(txRequest)

    const transactionResponse = await ownerSigner.sendTransaction(populatedRegisterSessionKeyTx)
    expect(transactionResponse.hash)
    return {
        secret,
        address,
        // master sessionKey has no whitelisting AND unlimited time validity
        isMaster: !whitelist && limit == BigInt(2**48 - 1)

    }
}

async function registerRandomMasterSessionKey(duration: bigint): Promise<sessionKey> {
    return registerRandomSessionKey(BigInt(2**48 - 1), duration)
}


// ================ START END TO END TESTS ===================================================================



describe("ERC20 interactions from Openfort Account", function () {

    const MOCK_ERC20_ON_SOPHON = "0x0a433954E786712354c5917D0870895c29EF7AE4";
    interface Tokens {
        mockERC20: `0x${string}`;
    }
    const tokens: Tokens = {
        mockERC20: MOCK_ERC20_ON_SOPHON
    };

    async function deployTokens() {
        // use alreayd whitelisted mocks on Sophon
        // deploy token contracts only once for all tests on other chains
        if (chain.name != "Sophon" && tokens.mockERC20 == MOCK_ERC20_ON_SOPHON) {
            const artifact = await hre.deployer.loadArtifact("MockERC20");
            const contract = await hre.deployer.deploy(artifact, [], "create")
            tokens.mockERC20 = await contract.getAddress()
            console.log(`MockERC20 deployed to ${tokens.mockERC20}`)
        }
    }

    it("sign with owner: balance should be updated", async function () {
        await deployTokens()

        // abi-encode contract call
        const amount = BigInt(42)
        const sender = openfortAccountAddress
        const data = mockERC20Interface.encodeFunctionData("mint", [sender, amount])

        const params = {
            type: utils.EIP712_TX_TYPE,
            to: tokens.mockERC20,
            data
        }

        const txRequest = buildTransactionRequest(params)

        const populatedTx = await ownerSmartAccount.populateTransaction(txRequest);

        const initialBalance = await ownerSmartAccount.getBalance(tokens.mockERC20)
        await ownerSmartAccount.sendTransaction(populatedTx)
        const finalBalance = await ownerSmartAccount.getBalance(tokens.mockERC20)

        console.log(`balance before mint: ${initialBalance}`)
        console.log(`balance after mint: ${finalBalance}`)

        expect(finalBalance - initialBalance).to.equal(amount);
    });

    it("register a session key and sign with it: balance should be updated", async function () {
        await deployTokens()

        const sessionKey = await registerRandomSessionKey(BigInt(100), ONE_DAY)
        const validSessionKeyAccount = new SmartAccount({ address: openfortAccountAddress, secret: sessionKey.secret }, provider)
        const amount = BigInt(42)
        const sender = openfortAccountAddress
        const mintData = mockERC20Interface.encodeFunctionData("mint", [sender, amount])

        const populatedMintTx = await ownerSmartAccount.populateTransaction(buildTransactionRequest({
            type: utils.EIP712_TX_TYPE,
            to: tokens.mockERC20,
            data: mintData
        }));

        await validSessionKeyAccount.sendTransaction(populatedMintTx)
    })

})