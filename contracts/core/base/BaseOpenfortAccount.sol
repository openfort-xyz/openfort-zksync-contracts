// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.19;

import {
    IAccount,
    ACCOUNT_VALIDATION_SUCCESS_MAGIC
} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IAccount.sol";
import {
    BOOTLOADER_FORMAL_ADDRESS,
    DEPLOYER_SYSTEM_CONTRACT,
    NONCE_HOLDER_SYSTEM_CONTRACT
} from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import {SystemContractsCaller} from
    "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";
import {
    TransactionHelper,
    Transaction
} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import {INonceHolder} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/INonceHolder.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {SafeCastUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import {IERC1271Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC1271Upgradeable.sol";

import {TokenCallbackHandler} from "./TokenCallbackHandler.sol";
import {OpenfortErrors} from "../../interfaces/OpenfortErrors.sol";
import {OpenfortEvents} from "../../interfaces/OpenfortEvents.sol";

/**
 * @title BaseOpenfortAccount (Non upgradeable by default)
 * @notice Smart contract wallet following the ZKsync AA standard with session keys support.
 * It inherits from:
 *  - IAccount to comply with ZKSync native Account Abstraction standard
 *  - Initializable because accounts are meant to be created using Factories
 *  - EIP712Upgradeable to use typed structured signatures EIP-712 (supporting ERC-5267 too)
 *  - IERC1271Upgradeable for Signature Validation (ERC-1271)
 *  - TokenCallbackHandler to support ERC-777, ERC-721 and ERC-1155
 */
abstract contract BaseOpenfortAccount is
    IAccount,
    Initializable,
    EIP712Upgradeable,
    IERC1271Upgradeable,
    TokenCallbackHandler,
    OpenfortErrors,
    OpenfortEvents
{
    using TransactionHelper for Transaction;
    using ECDSAUpgradeable for bytes32;

    // bytes4(keccak256("isValidSignature(bytes32,bytes)")
    bytes4 internal constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;
    // bytes4(keccak256("executeTransaction(bytes32,bytes32,Transaction)")
    bytes4 internal constant EXECUTE_SELECTOR = 0xbd76abb4;
    // keccak256("OpenfortMessage(bytes32 hashedMessage)");
    bytes32 internal constant OF_MSG_TYPEHASH = 0x57159f03b9efda178eab2037b2ec0b51ce11be0051b8a2a9992c29dc260e4a30;

    /**
     * Struct to keep track of session keys' data
     * @param validAfter this sessionKey is valid only after this timestamp.
     * @param validUntil this sessionKey is valid only until this timestamp.
     * @param limit limit of uses remaining
     * @param masterSessionKey if set to true, the session key does not have any limitation other than the validity time
     * @param whitelisting if set to true, the session key has to follow whitelisting rules
     * @param whitelist - this session key can only interact with the addresses in the whitelist.
     */
    struct SessionKeyStruct {
        uint48 validAfter;
        uint48 validUntil;
        uint48 limit;
        bool masterSessionKey;
        bool whitelisting;
        mapping(address contractAddress => bool allowed) whitelist;
        address registrarAddress;
    }

    mapping(address sessionKey => SessionKeyStruct sessionKeyData) public sessionKeys;

    constructor() {
        emit AccountImplementationDeployed(msg.sender);
        _disableInitializers();
    }

    function owner() public view virtual returns (address);

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader can call this method");
        _;
    }

    // ---------------------------------- //
    //             Validation             //
    // ---------------------------------- //

    /**
     * @inheritdoc IAccount
     */
    function validateTransaction(
        bytes32, //txHash
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) external payable override onlyBootloader returns (bytes4) {
        return _validateTransaction(_suggestedSignedHash, _transaction);
    }

    function _validateTransaction(bytes32 _suggestedSignedHash, Transaction calldata _transaction)
        internal
        returns (bytes4 magic)
    {
        // Incrementing the nonce of the account.
        // Note, that reserved[0] by convention is currently equal to the nonce passed in the transaction
        SystemContractsCaller.systemCallWithPropagatedRevert(
            uint32(gasleft()),
            address(NONCE_HOLDER_SYSTEM_CONTRACT),
            0,
            abi.encodeCall(INonceHolder.incrementMinNonceIfEquals, (_transaction.nonce))
        );

        // While the suggested signed hash is usually provided, it is generally
        // not recommended to rely on it to be present, since in the future
        // there may be tx types with no suggested signed hash.
        bytes32 txHash = _suggestedSignedHash == bytes32(0) ? _transaction.encodeHash() : _suggestedSignedHash;

        // explicitly check for insufficient funds to prevent user paying fee for a
        // transaction that wouldn't be included on Ethereum.
        uint256 totalRequiredBalance = _transaction.totalRequiredBalance();
        require(totalRequiredBalance <= address(this).balance, "Not enough balance for fee + value");

        if (_validateSignature(txHash, _transaction.signature, _transaction.data) == EIP1271_SUCCESS_RETURN_VALUE) {
            magic = ACCOUNT_VALIDATION_SUCCESS_MAGIC;
        } else {
            magic = "";
        }
    }

    function _validateSignature(bytes32 _hash, bytes memory _signature, bytes calldata transactionCallData)
        internal
        returns (bytes4 magic)
    {
        magic = EIP1271_SUCCESS_RETURN_VALUE;

        if (_signature.length != 65) {
            // Signature is invalid anyway, but we need to proceed with the signature verification as usual
            // in order for the fee estimation to work correctly
            _signature = new bytes(65);
            // Making sure that the signatures look like a valid ECDSA signature and are not rejected rightaway
            // while skipping the main verification process.
            _signature[64] = bytes1(uint8(27));
        }

        // extract ECDSA signature
        uint8 v;
        bytes32 r;
        bytes32 s;

        assembly {
            r := mload(add(_signature, 0x20))
            s := mload(add(_signature, 0x40))
            v := and(mload(add(_signature, 0x41)), 0xff)
        }

        // The v value in Ethereum signatures is usually 27 or 28.
        // However, some libraries may produce v values of 0 or 1.
        // This line ensures that v is correctly normalized to either 27 or 28.
        if (v < 27) v += 27;

        address signerAddress = ecrecover(_hash, v, r, s);

        // Note, that we should abstain from using the require here in order to allow for fee estimation to work
        if (signerAddress != owner() && signerAddress != address(0)) {
            // if not owner, try session key validation
            if (!isValidSessionKey(signerAddress, transactionCallData)) {
                magic = "";
            }
        }
    }

    /*
     * @notice Return whether a sessionKey is valid.
     */
    function isValidSessionKey(address _sessionKey, bytes calldata _callData) internal virtual returns (bool) {
        SessionKeyStruct storage sessionKey = sessionKeys[_sessionKey];
        // If not owner and the session key is revoked, return false
        if (sessionKey.validUntil == 0) return false;

        // If the sessionKey was not registered by the owner, return false
        // If the account is transferred or sold, isValidSessionKey() will return false with old session keys
        if (sessionKey.registrarAddress != owner()) return false;

        // TODO:
        // verify that sessionKey is active for the current `block.timestamp`
        // blocker: zkSync doesn't allow access to contextual variables in the AA signature validation

        // If the signer is a session key that is still valid
        // Let's first get the selector of the function that the caller is using
        bytes4 funcSelector =
            _callData[0] | (bytes4(_callData[1]) >> 8) | (bytes4(_callData[2]) >> 16) | (bytes4(_callData[3]) >> 24);

        if (funcSelector == EXECUTE_SELECTOR) {
            Transaction memory zkSyncTransaction;
            (,, zkSyncTransaction) = abi.decode(_callData[4:], (bytes32, bytes32, Transaction));

            address to = address(uint160(zkSyncTransaction.to));

            // Check if reenter, do not allow
            if (to == address(this)) return false;

            // Check if it is a masterSessionKey
            if (sessionKey.masterSessionKey) return true;

            // Limit of transactions per sessionKey reached
            if (sessionKey.limit == 0) return false;
            // Deduct one use of the limit for the given session key
            unchecked {
                sessionKey.limit = sessionKey.limit - 1;
            }

            // If there is no whitelist or there is, but the target is whitelisted, return true
            if (!sessionKey.whitelisting || sessionKey.whitelist[to]) {
                return true;
            }

            return false; // All other cases, deny
        }

        // If a session key is used for other functions other than executeTransaction(), deny
        return false;
    }

    /*
     * @notice See EIP-1271
     * Owner and session keys need to sign using EIP712.
     */
    function isValidSignature(bytes32 _hash, bytes memory _signature) public view override returns (bytes4) {
        bytes32 structHash = keccak256(abi.encode(OF_MSG_TYPEHASH, _hash));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(_signature);
        if (owner() == signer) return EIP1271_SUCCESS_RETURN_VALUE;

        SessionKeyStruct storage sessionKey = sessionKeys[signer];
        // If the signer is a session key that is still valid
        if (
            sessionKey.validUntil == 0 || sessionKey.validAfter > block.timestamp
                || sessionKey.validUntil < block.timestamp || (!sessionKey.masterSessionKey && sessionKey.limit < 1)
        ) {
            return 0xffffffff;
        } // Not owner or session key revoked
        else if (sessionKey.registrarAddress != owner()) {
            return 0xffffffff;
        } else {
            return EIP1271_SUCCESS_RETURN_VALUE;
        }
    }

    // ---------------------------------- //
    //             Execution              //
    // ---------------------------------- //

    /**
     * @inheritdoc IAccount
     */
    function executeTransaction(bytes32, bytes32, Transaction calldata _transaction)
        external
        payable
        override
        onlyBootloader
    {
        _executeTransaction(_transaction);
    }

    function executeTransactionFromOutside(Transaction calldata _transaction) external payable {
        _validateTransaction(bytes32(0), _transaction);
        _executeTransaction(_transaction);
    }

    function _executeTransaction(Transaction calldata _transaction) internal {
        address to = address(uint160(_transaction.to));
        require(to != address(DEPLOYER_SYSTEM_CONTRACT), "Deployment from smart account not supported");
        _call(to, _transaction.value, _transaction.data);
    }

    function payForTransaction(bytes32, bytes32, Transaction calldata _transaction)
        external
        payable
        override
        onlyBootloader
    {
        bool success = _transaction.payToTheBootloader();
        require(success, "Failed to pay the fee to the operator");
    }

    function prepareForPaymaster(
        bytes32, // _txHash
        bytes32, // _suggestedSignedHash
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        _transaction.processPaymasterInput();
    }

    fallback() external {
        // fallback of default account shouldn't be called by bootloader under no circumstances
        assert(msg.sender != BOOTLOADER_FORMAL_ADDRESS);
        // If the contract is called directly, behave like an EOA
    }

    receive() external payable {
        // If the contract is called directly, behave like an EOA.
        // Note, that is okay if the bootloader sends funds with no calldata as it may be used for refunds/operator payments
    }

    /**
     * Register a session key to the account
     * @param _key session key to register
     * @param _validAfter - this session key is valid only after this timestamp.
     * @param _validUntil - this session key is valid only up to this timestamp.
     * @param _limit - limit of uses remaining.
     * @param _whitelist - this session key can only interact with the addresses in the _whitelist.
     */
    function registerSessionKey(
        address _key,
        uint48 _validAfter,
        uint48 _validUntil,
        uint48 _limit,
        address[] calldata _whitelist
    ) external virtual {
        _requireFromOwner();
        require(_validUntil > block.timestamp, "Cannot register an expired session key");
        require(_validAfter < _validUntil, "_validAfter must be lower than _validUntil");
        require(sessionKeys[_key].validUntil == 0, "SessionKey already registered");
        require(_whitelist.length < 11, "Whitelist too big");
        uint256 i;
        for (i; i < _whitelist.length;) {
            sessionKeys[_key].whitelist[_whitelist[i]] = true;
            unchecked {
                ++i;
            }
        }
        if (i != 0) {
            // If there is some whitelisting, it is not a masterSessionKey
            sessionKeys[_key].whitelisting = true;
            sessionKeys[_key].masterSessionKey = false;
        } else {
            // If there is some limit, it is not a masterSessionKey
            if (_limit == ((2 ** 48) - 1)) {
                sessionKeys[_key].masterSessionKey = true;
            } else {
                sessionKeys[_key].masterSessionKey = false;
            }
        }

        sessionKeys[_key].validAfter = _validAfter;
        sessionKeys[_key].validUntil = _validUntil;
        sessionKeys[_key].limit = _limit;
        sessionKeys[_key].registrarAddress = owner();

        emit SessionKeyRegistered(_key);
    }

    /**
     * Revoke a session key from the account
     * @param _key session key to revoke
     */
    function revokeSessionKey(address _key) external virtual {
        _requireFromOwner();
        if (sessionKeys[_key].validUntil != 0) {
            sessionKeys[_key].validUntil = 0;
            sessionKeys[_key].limit = 0;
            sessionKeys[_key].masterSessionKey = false;
            sessionKeys[_key].registrarAddress = address(0);
            emit SessionKeyRevoked(_key);
        }
    }

    /**
     * @dev Call a target contract and reverts if it fails.
     */
    function _call(address _target, uint256 _value, bytes calldata _calldata) internal virtual {
        (bool success, bytes memory result) = _target.call{value: _value}(_calldata);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * Require the function call went through owner
     */
    function _requireFromOwner() internal view {
        if (msg.sender != owner()) {
            revert NotOwner();
        }
    }
}
