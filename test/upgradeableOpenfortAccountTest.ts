import { expect } from "chai"

import { buildTransactionRequest, getViemChainFromConfig } from "../tasks/utils"
import { SmartAccount, Provider, types, utils } from "zksync-ethers"

import { generatePrivateKey } from "viem/accounts"
import { createPublicClient, http } from "viem"

import { Interface } from "ethers"
import { privateKeyToAccount } from "viem/accounts"


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


// GLOBAL test configuration

const privateKey = hre.network.config.accounts[0]
const provider = Provider.getDefaultProvider(types.Network.EraTestNode)
const ownerAccount = new SmartAccount({ address: openfortAccountAddress, secret: privateKey }, provider)

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
        // this works only if a smart account is alrady deployed at the address: 0x67b056e28ae03840E207C111164fDd9e89a933a6
        // and exported as env var ACCOUNT_IMPLEMENTATION_ADDRESS=0x67b056e28ae03840E207C111164fDd9e89a933a6
        // follow instruction in README to deploy your own and export the deployed address

        
        const params = {
            type: utils.EIP712_TX_TYPE,
            to: tokens.mockERC20,
            data
        }
        
        const txRequest = buildTransactionRequest(params)
        console.log(txRequest);

        const populatedTx = await ownerAccount.populateTransaction(txRequest);

        const initialBalance = await ownerAccount.getBalance(tokens.mockERC20)

        await ownerAccount.sendTransaction(populatedTx)

        const finalBalance = await ownerAccount.getBalance(tokens.mockERC20)

        console.log(`balance before mint: ${initialBalance}`)
        console.log(`balance after mint: ${finalBalance}`)
       
        expect(finalBalance - initialBalance).to.equal(amount);
    });

    it("register a session key and sign with it: balance should be updated", async function() {
        await deployTokens()

        const blockTimestamp = (await publicClient.getBlock()).timestamp

        // generate a new private key
        // to avoid Account contract reverts with "SessionKey already registered"

        const sessionKey = generatePrivateKey()
        const sessionKeyAddress = privateKeyToAccount(sessionKey).address

        console.log(`session key address ${sessionKeyAddress}`)

        // abi-encode contract call
        const registerSessionKeyData = baseOpenfortAccountInterface.encodeFunctionData("registerSessionKey", [
            sessionKeyAddress,
            blockTimestamp,
            blockTimestamp + BigInt(24 * 60 * 60), // active for 24 hours
            100, // limit
            [] // empty whitelist
        ])


        const params = {
            type: utils.EIP712_TX_TYPE,
            to: openfortAccountAddress,
            data: registerSessionKeyData,
        }
        const txRequest = buildTransactionRequest(params)
        const populatedRegisterSessionKeyTx = await ownerAccount.populateTransaction(txRequest)

        const txReceipt = await ownerAccount.sendTransaction(populatedRegisterSessionKeyTx)

        console.log(txReceipt)

        const validSessionKeyAccount = new SmartAccount({ address: openfortAccountAddress, secret: sessionKey }, provider)

        const amount = BigInt(42)
        const sender = openfortAccountAddress
        const mintData = mockERC20Interface.encodeFunctionData("mint", [sender, amount])

        const populatedMintTx = await ownerAccount.populateTransaction(buildTransactionRequest({
            type: utils.EIP712_TX_TYPE,
            to: tokens.mockERC20,
            data: mintData
        }));

        await validSessionKeyAccount.sendTransaction(populatedMintTx)
    })

})