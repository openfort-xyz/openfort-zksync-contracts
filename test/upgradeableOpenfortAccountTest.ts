import { expect } from "chai"

import { getViemChainFromConfig, writeContract } from "../tasks/utils"
import { SmartAccount, Provider, types, utils } from "zksync-ethers";

const chain = getViemChainFromConfig()
const openfortAccountAddress = hre.openfortAccountAddress

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

        // ethers
        const ADDRESS = openfortAccountAddress;
        const PRIVATE_KEY = hre.network.config.accounts[0];
        const provider = Provider.getDefaultProvider(types.Network.EraTestNode)
        const account = new SmartAccount({ address: ADDRESS, secret: PRIVATE_KEY }, provider);
        const initialBalance = await account.getBalance(tokens.mockERC20)
        const amount = BigInt(42);

        // this works only if a smart account is alrady deployed at the address: 0x67b056e28ae03840E207C111164fDd9e89a933a6
        // and exported as env var ACCOUNT_IMPLEMENTATION_ADDRESS=0x67b056e28ae03840E207C111164fDd9e89a933a6
        // follow instruction in README to deploy your own and export the deployed address
        const populatedTx = await account.populateTransaction({
            type: utils.EIP712_TX_TYPE,
            to: tokens.mockERC20,
            // cast calldata "function mint(address sender, uint256 amount)" 0x67b056e28ae03840E207C111164fDd9e89a933a6 42
            data: "0x40c10f1900000000000000000000000067b056e28ae03840e207c111164fdd9e89a933a6000000000000000000000000000000000000000000000000000000000000002a",
        });

        await account.sendTransaction(populatedTx)
        const finalBalance = await account.getBalance(tokens.mockERC20)
        expect(finalBalance - initialBalance).to.equal(amount);
    });
})