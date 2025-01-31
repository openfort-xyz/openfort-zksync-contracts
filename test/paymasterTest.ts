import chai from "chai";
import chaiAsPromised from "chai-as-promised";

import {
    createPublicClient,
    http,
    parseAbi,
    Address,
    Hex,
    encodePacked,
    keccak256,
    hexToBytes,
    toHex,
    getAddress,
    encodeFunctionData,
    createWalletClient,
    hashTypedData,
    parseEther,
    type LocalAccount,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getViemChainFromConfig, sleep, writeContract } from "../tasks/utils";
import hre from "hardhat";
import {
    getGeneralPaymasterInput,
    getApprovalBasedPaymasterInput,
    eip712WalletActions,
    serializeTransaction,
    ZksyncTransactionSerializable,
} from "viem/zksync";

chai.use(chaiAsPromised);
const expect = chai.expect;

const paymasterOwner = privateKeyToAccount(hre.network.config.accounts[0]);
const wrongSigner = privateKeyToAccount(generatePrivateKey());

const chain = getViemChainFromConfig();
const publicClient = createPublicClient({
    chain,
    transport: http(),
});

const walletClient = createWalletClient({
    account: paymasterOwner,
    chain,
    transport: http(hre.network.config.url),
}).extend(eip712WalletActions());

const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address;
const ETH_DECIMALS = 18n;

type PaymasterInputData = {
    from: Address;
    to: Address;
    data: Hex;
    value?: bigint;
    maxFeePerGas: bigint;
    gasLimit: bigint;
    nonce: bigint;
};

async function getZKSyncPaymasterInputData(
    paymasterInputData: PaymasterInputData,
    chainId: ChainId,
    policy: PolicySponsorSchema,
    signer: LocalAccount = paymasterOwner,
): Promise<Hex> {
    if ([ChainId.Sophon, ChainId.SophonTestnet].includes(chainId)) {
        // accounts are whitelisted by sophon paymaster when deployed (most likely...)
        // no need to sign anything -  all transactions sponsored by default
        return getGeneralPaymasterInput({ innerInput: new Uint8Array() });
    }

    // Note: rate is the ETH/TOKEN price
    const { token, rate } = await getTokenInfo(policy);

    const encodedData = encodePacked(
        ["address", "address", "bytes", "uint256", "uint256", "uint256", "uint256", "address", "uint256"],
        [
            paymasterInputData.from,
            paymasterInputData.to,
            paymasterInputData.data,
            paymasterInputData.value ?? 0n,
            paymasterInputData.maxFeePerGas,
            paymasterInputData.gasLimit,
            paymasterInputData.nonce,
            token,
            rate,
        ],
    );

    const hash = keccak256(encodedData);
    const signature = await signer.signMessage({ message: { raw: hash } });

    // General flow for native token sponsorship
    if (policy.sponsorshipType === SponsorshipType.PAY_FOR_USER) {
        return getGeneralPaymasterInput({ innerInput: signature });
    }

    const innerInput = encodePacked(["uint256", "bytes"], [rate, signature]);
    const minAllowance = calculateMinAllowance(paymasterInputData, rate);

    // With the approval based paymaster flow, user can approve
    // the required amount of tokens to the paymaster within the same transaction
    return getApprovalBasedPaymasterInput({ innerInput, token, minAllowance });
}

const getTokenInfo = async (policy: PolicySponsorSchema): Promise<{ token: Address; rate: bigint }> => {
    const isPayForUser = policy.sponsorshipType === SponsorshipType.PAY_FOR_USER;
    const token = isPayForUser ? ETH_ADDRESS : getAddress(policy.tokenContractAddress);
    const rate = isPayForUser ? 1n : policy.tokenContractAmount;

    // TODO: to remove following call - store decimals of ERC20 available for sponsorship in db
    const decimals = isPayForUser
        ? 0n
        : BigInt(
              await publicClient.readContract({
                  address: getAddress(token),
                  abi: parseAbi(["function decimals() external view returns (uint8)"]),
                  functionName: "decimals",
              }),
          );

    return { token, rate: rate * 10n ** decimals };
};

const calculateMinAllowance = (params: PaymasterInputData, rate: bigint): bigint => {
    const requiredEth = params.maxFeePerGas * params.gasLimit;
    const minAllowance = (requiredEth * rate) / 10n ** ETH_DECIMALS;
    console.log("requiredEth", requiredEth);
    console.log("rate", rate);
    console.log("minAllowance", minAllowance);
    return minAllowance;
};

describe("Paymaster", function () {
    let paymasterAddress;
    let nftAddress;
    let randomAccount;
    let randomAccountClient;
    let mockERC20Address;

    before(async function () {
        if (hre.network.config.url.includes("sophon")) {
            console.log("Cant use custom Paymaster on Sophon networks: Skipping test");
            this.skip();
        }
        const paymasterArtifact = await hre.deployer.loadArtifact("MultiTokenPaymaster");
        const paymaster = await hre.deployer.deploy(paymasterArtifact, [paymasterOwner.address], "create");
        paymasterAddress = await paymaster.getAddress();
        console.log("paymasterAddress", paymasterAddress);
        await walletClient.sendTransaction({
            to: paymasterAddress,
            value: parseEther("0.001"),
        });

        const nftArtifact = await hre.deployer.loadArtifact("SimpleNFT");
        const nft = await hre.deployer.deploy(nftArtifact, [], "create");
        nftAddress = await nft.getAddress();
        console.log("nftAddress", nftAddress);

        const randomPrivateKey = generatePrivateKey();
        randomAccount = privateKeyToAccount(randomPrivateKey);
        randomAccountClient = createWalletClient({
            account: randomAccount,
            chain,
            transport: http(hre.network.config.url),
        });

        const mockERC20Artifact = await hre.deployer.loadArtifact("MockERC20");
        const mockERC20 = await hre.deployer.deploy(mockERC20Artifact, [], "create");

        mockERC20Address = await mockERC20.getAddress();
        console.log("mockERC20", mockERC20Address);
    });

    it("should validate the paymaster signature correctly", async function () {
        const abi = parseAbi([
            "function isValidSignature(bytes memory, (address, address, bytes, uint256, uint256, uint256, uint256), address, uint256) public view returns (bool)",
        ]);

        // Prepare sample input data
        const sampleInputData: PaymasterInputData = {
            from: getAddress("0x9590Ed0C18190a310f4e93CAccc4CC17270bED40"),
            to: getAddress("0x6D62c01040B51405acdF9C32577ca91FB64B8727"),
            data: "0x5b31f150000000000000000000000000a12142d1f098ec56860927977d5695cd6b79f96780e9d356ed5647c15ae7b8509522ba5ba4af1bc1bfb5df741f1dcb73656ed0d00000000000000000000000000000000000000000000000000000000000000000" as Hex,
            maxFeePerGas: 46037767n,
            gasLimit: 2219764n,
            nonce: 1234n,
        };

        const tokenPolicy: TokenPolicySchema = {
            id: 1,
            uuid: "123",
            enabled: true,
            sponsorshipType: SponsorshipType.FIXED_RATE,
            tokenContractAddress: getAddress(mockERC20Address),
            tokenContractAmount: 32n,
            allowFunctions: [],
            chainId: ChainId.ZKSyncSepolia,
        };

        const nativePolicy: PayForUserPolicySchema = {
            id: 1,
            uuid: "123",
            enabled: true,
            sponsorshipType: SponsorshipType.PAY_FOR_USER,
            allowFunctions: [],
            chainId: ChainId.ZKSyncSepolia,
        };

        const paymasterInputDataToken = await getZKSyncPaymasterInputData(
            sampleInputData,
            ChainId.ZKSyncSepolia,
            tokenPolicy,
        );
        const signatureToken = toHex(hexToBytes(paymasterInputDataToken).slice(-96, -31));

        // Call the _isValidSignature function
        const isValid = await publicClient.readContract({
            address: paymasterAddress as Address,
            abi,
            functionName: "isValidSignature",
            args: [
                signatureToken,
                [
                    sampleInputData.from,
                    sampleInputData.to,
                    sampleInputData.data,
                    sampleInputData.value ?? 0n,
                    sampleInputData.maxFeePerGas,
                    sampleInputData.gasLimit,
                    sampleInputData.nonce,
                ],
                tokenPolicy.tokenContractAddress,
                tokenPolicy.tokenContractAmount * 10n ** 18n,
            ],
        });

        // Assert that the signature is valid
        expect(isValid).to.be.true;

        const paymasterInputDataNative = await getZKSyncPaymasterInputData(
            sampleInputData,
            ChainId.ZKSyncSepolia,
            nativePolicy,
        );
        const signatureNative = toHex(hexToBytes(paymasterInputDataNative).slice(-96, -31));

        // Call the _isValidSignature function
        const isValidNative = await publicClient.readContract({
            address: paymasterAddress as Address,
            abi,
            functionName: "isValidSignature",
            args: [
                signatureNative,
                [
                    sampleInputData.from,
                    sampleInputData.to,
                    sampleInputData.data,
                    sampleInputData.value ?? 0n,
                    sampleInputData.maxFeePerGas,
                    sampleInputData.gasLimit,
                    sampleInputData.nonce,
                ],
                ETH_ADDRESS,
                1n,
            ],
        });

        expect(isValidNative).to.be.true;

        const invalidSignature = "0x1234567890" as Hex;

        const isInvalid = await publicClient.readContract({
            address: paymasterAddress as Address,
            abi,
            functionName: "isValidSignature",
            args: [
                invalidSignature,
                [
                    sampleInputData.from,
                    sampleInputData.to,
                    sampleInputData.data,
                    sampleInputData.value ?? 0n,
                    sampleInputData.maxFeePerGas,
                    sampleInputData.gasLimit,
                    sampleInputData.nonce,
                ],
                tokenPolicy.tokenContractAddress,
                tokenPolicy.tokenContractAmount,
            ],
        });

        expect(isInvalid).to.be.false;
    });

    it("should buy a mock NFT and sponsor gas with ERC20", async function () {
        // DEPLOY MOCKERC209 with 9 decimals
        // Note: Not all ERC20s have 18 decimals
        // For example, USDC has 6 decimals: https://etherscan.io/address/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48#readProxyContract

        const mockERC209Artifact = await hre.deployer.loadArtifact("MockERC209");
        const mockERC209 = await hre.deployer.deploy(mockERC209Artifact, [], "create");
        const mockERC209Address = await mockERC209.getAddress();
        // 32 MOCK tokens for 1 ETH
        const rate = 32n;
        const tokenPolicyMockERC20: TokenPolicySchema = {
            id: 1,
            uuid: "123",
            enabled: true,
            sponsorshipType: SponsorshipType.FIXED_RATE,
            tokenContractAddress: getAddress(mockERC20Address),
            tokenContractAmount: rate,
            allowFunctions: [],
            chainId: chain.id,
        };

        const tokenPolicyMockERC209: TokenPolicySchema = {
            id: 1,
            uuid: "123",
            enabled: true,
            sponsorshipType: SponsorshipType.FIXED_RATE,
            tokenContractAddress: getAddress(mockERC209Address),
            tokenContractAmount: rate,
            allowFunctions: [],
            chainId: chain.id,
        };

        // SEND ERC20 token to random account for gas
        await writeContract(walletClient, {
            address: mockERC20Address,
            abi: parseAbi(["function mint(address _to, uint256 _amount) external"]),
            functionName: "mint",
            args: [randomAccount.address, rate * BigInt(10 ** 18)],
        });

        await writeContract(walletClient, {
            address: mockERC209Address,
            abi: parseAbi(["function mint(address _to, uint256 _amount) external"]),
            functionName: "mint",
            args: [randomAccount.address, rate * BigInt(10 ** 9)],
        });

        const mintNFTtx = await randomAccountClient.prepareTransactionRequest({
            type: "eip712",
            account: randomAccount,
            from: randomAccount.address,
            chainId: chain.id,
            to: getAddress(nftAddress),
            data: encodeFunctionData({
                abi: parseAbi(["function mint(address _to) external"]),
                args: [randomAccount.address],
            }),
        });

        const sampleInputData: PaymasterInputData = {
            from: randomAccount.address,
            to: getAddress(nftAddress),
            data: encodeFunctionData({
                abi: parseAbi(["function mint(address _to) external"]),
                args: [randomAccount.address],
            }),
            maxFeePerGas: mintNFTtx.maxFeePerGas,
            gasLimit: mintNFTtx.gas,
            nonce: BigInt(mintNFTtx.nonce),
        };

        const signableMintNFTTransaction = {
            type: "eip712",
            from: randomAccount.address,
            chainId: chain.id,
            to: getAddress(nftAddress),
            data: encodeFunctionData({
                abi: parseAbi(["function mint(address _to) external"]),
                args: [randomAccount.address],
            }),
            nonce: mintNFTtx.nonce,
            gas: mintNFTtx.gas,
            maxFeePerGas: mintNFTtx.maxFeePerGas,
            maxPriorityFeePerGas: mintNFTtx.maxPriorityFeePerGas,
            paymaster: paymasterAddress,
            paymasterInput: await getZKSyncPaymasterInputData(
                sampleInputData,
                chain.id as ChainId,
                tokenPolicyMockERC20,
            ),
        };

        const EIP712hash = hashTypedData(
            chain.custom.getEip712Domain(signableMintNFTTransaction as ZksyncTransactionSerializable),
        );
        const signature = await randomAccount.sign({ hash: EIP712hash });

        const signedTransaction = serializeTransaction({
            ...signableMintNFTTransaction,
            customSignature: signature,
        });

        const hash = await publicClient.sendRawTransaction({
            serializedTransaction: signedTransaction,
        });

        console.log("Mint NFT tx: gas sponsored with mockERC20 (18 decimals): ", hash);

        const paymasterMockERC20Balance = await publicClient.readContract({
            address: getAddress(mockERC20Address),
            abi: parseAbi(["function balanceOf(address account) external view returns (uint256)"]),
            functionName: "balanceOf",
            args: [paymasterAddress],
        });

        // wait for the transaction to be included
        await sleep(2000);

        const requiredEth = mintNFTtx.maxFeePerGas * mintNFTtx.gas;
        const minAllowanceERC20 = (BigInt(requiredEth) * rate * 10n ** 18n) / 10n ** 18n;
        expect(paymasterMockERC20Balance).to.be.equal(minAllowanceERC20);

        ////////////////////////////////////////////////////////////////////////////////////////////

        sampleInputData.nonce += 1n;
        signableMintNFTTransaction.nonce += 1;
        signableMintNFTTransaction.paymasterInput = await getZKSyncPaymasterInputData(
            sampleInputData,
            chain.id as ChainId,
            tokenPolicyMockERC209,
        );

        const EIP712hash2 = hashTypedData(
            chain.custom.getEip712Domain(signableMintNFTTransaction as ZksyncTransactionSerializable),
        );
        const signature2 = await randomAccount.sign({ hash: EIP712hash2 });

        const signedTransaction2 = serializeTransaction({
            ...signableMintNFTTransaction,
            customSignature: signature2,
        });

        const hash2 = await publicClient.sendRawTransaction({
            serializedTransaction: signedTransaction2,
        });

        console.log("Mint NFT tx: gas sponsored with mockERC209 (9 decimals): ", hash2);

        const paymasterMockERC209Balance = await publicClient.readContract({
            address: getAddress(mockERC209Address),
            abi: parseAbi(["function balanceOf(address account) external view returns (uint256)"]),
            functionName: "balanceOf",
            args: [paymasterAddress],
        });

        const minAllowanceERC209 = (BigInt(requiredEth) * rate * 10n ** 9n) / 10n ** 18n;
        expect(paymasterMockERC209Balance).to.be.equal(minAllowanceERC209);
    });

    it("should buy a mock NFT and sponsor gas with ETH", async function () {
        const nativePolicy: PayForUserPolicySchema = {
            id: 1,
            uuid: "123",
            enabled: true,
            sponsorshipType: SponsorshipType.PAY_FOR_USER,
            allowFunctions: [],
            chainId: chain.id,
        };

        const mintNFTtx = await randomAccountClient.prepareTransactionRequest({
            type: "eip712",
            account: randomAccount,
            from: randomAccount.address,
            chainId: chain.id,
            to: getAddress(nftAddress),
            data: encodeFunctionData({
                abi: parseAbi(["function mint(address _to) external"]),
                args: [randomAccount.address],
            }),
        });

        const sampleInputData: PaymasterInputData = {
            from: randomAccount.address,
            to: getAddress(nftAddress),
            data: encodeFunctionData({
                abi: parseAbi(["function mint(address _to) external"]),
                args: [randomAccount.address],
            }),
            maxFeePerGas: mintNFTtx.maxFeePerGas,
            gasLimit: mintNFTtx.gas,
            nonce: BigInt(mintNFTtx.nonce),
        };

        const paymasterInputData = await getZKSyncPaymasterInputData(
            sampleInputData,
            chain.id as ChainId,
            nativePolicy,
        );

        const signableMintNFTTransaction = {
            type: "eip712",
            from: randomAccount.address,
            chainId: chain.id,
            to: getAddress(nftAddress),
            data: encodeFunctionData({
                abi: parseAbi(["function mint(address _to) external"]),
                args: [randomAccount.address],
            }),
            nonce: mintNFTtx.nonce,
            gas: mintNFTtx.gas,
            maxFeePerGas: mintNFTtx.maxFeePerGas,
            maxPriorityFeePerGas: mintNFTtx.maxPriorityFeePerGas,
            paymaster: paymasterAddress,
            paymasterInput: paymasterInputData,
        };

        const EIP712hash = hashTypedData(
            chain.custom.getEip712Domain(signableMintNFTTransaction as ZksyncTransactionSerializable),
        );
        const signature = await randomAccount.sign({ hash: EIP712hash });

        const signedTransaction = serializeTransaction({
            ...signableMintNFTTransaction,
            customSignature: signature,
        });

        const hash = await publicClient.sendRawTransaction({
            serializedTransaction: signedTransaction,
        });
        console.log("Mint NFT tx: gas sponsored with native token: ", hash);
    });

    it("should fail when signing paymaster input with wrong signer", async function () {
        const nativePolicy: PayForUserPolicySchema = {
            id: 1,
            uuid: "123",
            enabled: true,
            sponsorshipType: SponsorshipType.PAY_FOR_USER,
            allowFunctions: [],
            chainId: chain.id,
        };
        const mintNFTtx = await randomAccountClient.prepareTransactionRequest({
            type: "eip712",
            account: randomAccount,
            from: randomAccount.address,
            chainId: chain.id,
            to: getAddress(nftAddress),
            data: encodeFunctionData({
                abi: parseAbi(["function mint(address _to) external"]),
                args: [randomAccount.address],
            }),
        });

        const sampleInputData: PaymasterInputData = {
            from: randomAccount.address,
            to: getAddress(nftAddress),
            data: encodeFunctionData({
                abi: parseAbi(["function mint(address _to) external"]),
                args: [randomAccount.address],
            }),
            maxFeePerGas: mintNFTtx.maxFeePerGas,
            gasLimit: mintNFTtx.gas,
            nonce: BigInt(mintNFTtx.nonce),
        };

        const paymasterInputData = await getZKSyncPaymasterInputData(
            sampleInputData,
            chain.id as ChainId,
            nativePolicy,
            wrongSigner, // Signing paymaster input with any other private key than the owner of the paymaster will fail
        );

        const signableMintNFTTransaction = {
            type: "eip712",
            from: randomAccount.address,
            chainId: chain.id,
            to: getAddress(nftAddress),
            data: encodeFunctionData({
                abi: parseAbi(["function mint(address _to) external"]),
                args: [randomAccount.address],
            }),
            nonce: mintNFTtx.nonce,
            gas: mintNFTtx.gas,
            maxFeePerGas: mintNFTtx.maxFeePerGas,
            maxPriorityFeePerGas: mintNFTtx.maxPriorityFeePerGas,
            paymaster: paymasterAddress,
            paymasterInput: paymasterInputData,
        };

        const EIP712hash = hashTypedData(
            chain.custom.getEip712Domain(signableMintNFTTransaction as ZksyncTransactionSerializable),
        );
        const signature = await randomAccount.sign({ hash: EIP712hash });

        const signedTransaction = serializeTransaction({
            ...signableMintNFTTransaction,
            customSignature: signature,
        });

        await expect(publicClient.sendRawTransaction({
            serializedTransaction: signedTransaction,
        })).to.be.rejectedWith("Account validation error: Paymaster validation returned invalid magic value");
    });
});

interface UuidIdentifier {
    uuid: string;
}

enum SponsorshipType {
    PAY_FOR_USER = "pay_for_user",
    CHARGE_CUSTOM_TOKENS = "charge_custom_tokens",
    FIXED_RATE = "fixed_rate",
}

interface BasePolicySchema {
    id: number;
    uuid: string;
    enabled: boolean;
    allowFunctions: Array<{
        wildcardSponsor: boolean;
        functionName: string | null;
        type: PolicyRuleType | null;
        contract: UuidIdentifier | null;
    }>;
    sponsorshipType: SponsorshipType;
    sponsorshipGasLimit?: bigint;
    balanceLimit?: bigint;
    depositorAddress?: string;
    chainId: number;
}

interface TokenPolicySchema extends BasePolicySchema {
    sponsorshipType: SponsorshipType.CHARGE_CUSTOM_TOKENS | SponsorshipType.FIXED_RATE;
    tokenContractAmount: bigint;
    tokenContractAddress: Address;
}

type PayForUserPolicySchema = BasePolicySchema & {
    sponsorshipType: SponsorshipType.PAY_FOR_USER;
};

type PolicySponsorSchema = TokenPolicySchema | PayForUserPolicySchema;

enum PolicyRuleType {
    CONTRACT = "contract_functions",
    ACCOUNT = "account_functions",
    RATE_LIMIT = "rate_limit",
}

enum ChainId {
    ZKSyncSepolia = 300,
    SophonTestnet = 531050104,
    Sophon = 50104,
}
