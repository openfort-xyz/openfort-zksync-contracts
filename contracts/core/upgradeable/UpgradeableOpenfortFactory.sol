// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.19;

import {IContractDeployer, DEPLOYER_SYSTEM_CONTRACT} from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import {SystemContractsCaller} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

import {UpgradeableOpenfortAccount} from "./UpgradeableOpenfortAccount.sol";
import {UpgradeableOpenfortProxy} from "./UpgradeableOpenfortProxy.sol";
import {BaseOpenfortFactory} from "../base/BaseOpenfortFactory.sol";

/**
 * @title UpgradeableOpenfortFactory (Non-upgradeable)
 * @notice Contract to create an on-chain factory to deploy new UpgradeableOpenfortAccounts.
 * It inherits from:
 *  - BaseOpenfortFactory
 */
contract UpgradeableOpenfortFactory is BaseOpenfortFactory {
    uint256 public recoveryPeriod;
    uint256 public securityPeriod;
    uint256 public securityWindow;
    uint256 public lockPeriod;
    address public initialGuardian;
    bytes32 public upgradeableOpenfortProxyCodeHash;

    event Debug(uint256 d);

    error TooManyInitialGuardians();

    /**
     * @dev Emitted when the initial guardian is changed.
     */
    event InitialGuardianUpdated(
        address indexed oldInitialGuardian,
        address indexed newInitialGuardian
    );

    constructor(
        address _owner,
        address _accountImplementation,
        uint256 _recoveryPeriod,
        uint256 _securityPeriod,
        uint256 _securityWindow,
        uint256 _lockPeriod,
        address _initialGuardian
    ) BaseOpenfortFactory(_owner, _accountImplementation) {
        upgradeableOpenfortProxyCodeHash = hashL2Bytecode(
            type(UpgradeableOpenfortProxy).creationCode
        );

        if (
            _lockPeriod < _recoveryPeriod ||
            _recoveryPeriod < _securityPeriod + _securityWindow
        ) {
            revert InsecurePeriod();
        }
        recoveryPeriod = _recoveryPeriod;
        securityPeriod = _securityPeriod;
        securityWindow = _securityWindow;
        lockPeriod = _lockPeriod;
        if (_initialGuardian == address(0)) revert ZeroAddressNotAllowed();
        initialGuardian = _initialGuardian;
    }

    function updateInitialGuardian(
        address _newInitialGuardian
    ) external onlyOwner {
        if (_newInitialGuardian == address(0)) revert ZeroAddressNotAllowed();
        emit InitialGuardianUpdated(initialGuardian, _newInitialGuardian);
        initialGuardian = _newInitialGuardian;
    }

    /*
     * @notice Deploy a new account for _admin with a _nonce.
     */
    function createAccountWithNonce(
        address _admin,
        bytes32 _nonce,
        bool _initializeGuardian
    ) external returns (address account) {
        bytes32 salt = keccak256(abi.encode(_admin, _nonce));
        account = getAddressWithNonce(_admin, _nonce);
        uint256 codelen;
        assembly {
            codelen := extcodesize(account)
        }
        if (codelen > 0) return account;
        account = address(
            new UpgradeableOpenfortProxy{salt: salt}(_implementation, "")
        );
        (bool success, bytes memory returnData) = SystemContractsCaller
            .systemCallWithReturndata(
                uint32(gasleft()),
                address(DEPLOYER_SYSTEM_CONTRACT),
                uint128(0),
                abi.encodeCall(
                    DEPLOYER_SYSTEM_CONTRACT.create2Account,
                    (
                        salt,
                        // Contract Bytecode Hash
                        upgradeableOpenfortProxyCodeHash,
                        abi.encode(_implementation, ""),
                        IContractDeployer.AccountAbstractionVersion.Version1
                    )
                )
            );

        require(
            success,
            string(abi.encodePacked("Deployment Failed: ", returnData))
        );
        emit AccountCreated(account, _admin);

        UpgradeableOpenfortAccount(payable(account)).initialize(
            _admin,
            recoveryPeriod,
            securityPeriod,
            securityWindow,
            lockPeriod,
            _initializeGuardian ? initialGuardian : address(0)
        );

        (account) = abi.decode(returnData, (address));
        //return account;
    }

    /*
     * @notice Return the address of an account that would be deployed with the given _admin signer and _nonce.
     */
    function getAddressWithNonce(
        address _admin,
        bytes32 _nonce
    ) public returns (address account) {
        bytes32 salt = keccak256(abi.encode(_admin, _nonce));

        (bool success, bytes memory returnData) = SystemContractsCaller
            .systemCallWithReturndata(
                uint32(gasleft()),
                address(DEPLOYER_SYSTEM_CONTRACT),
                uint128(0),
                abi.encodeCall(
                    DEPLOYER_SYSTEM_CONTRACT.getNewAddressCreate2,
                    (
                        // Deployer address
                        address(this),
                        upgradeableOpenfortProxyCodeHash,
                        salt,
                        // Constructor Bytecode
                        abi.encode(_implementation, "")
                    )
                )
            );
        require(
            success,
            string(
                abi.encodePacked(
                    "zkSync CREATE 2 address calculation failed",
                    returnData
                )
            )
        );
        (account) = abi.decode(returnData, (address));
    }

    function hashL2Bytecode(
        bytes memory _bytecode
    ) internal returns (bytes32 hashedBytecode) {
        
        uint256 bytecodeLength = _bytecode.length;
        uint256 paddingLength = (32 - (bytecodeLength % 32)) % 32;
        
        if (paddingLength > 0) {
            bytes memory paddedCreationCode = new bytes(
                bytecodeLength + paddingLength
            );
            for (uint256 i = 0; i < bytecodeLength; i++) {
                paddedCreationCode[i] = _bytecode[i];
            }
            // Padding with zeros
            for (
                uint256 i = bytecodeLength;
                i < paddedCreationCode.length;
                i++
            ) {
                paddedCreationCode[i] = 0x00;
            }
            _bytecode = paddedCreationCode;
        }

        // Note that the length of the bytecode must be provided in 32-byte words.
        require(_bytecode.length % 32 == 0, "po");

        uint256 bytecodeLenInWords = _bytecode.length / 32;
        require(bytecodeLenInWords < 2 ** 16, "pp"); // bytecode length must be less than 2^16 words
        require(bytecodeLenInWords % 2 == 1, "pr"); // bytecode length in words must be odd
        hashedBytecode =
            sha256(_bytecode) &
            0x00000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
        // Setting the version of the hash
        hashedBytecode = (hashedBytecode | bytes32(uint256(1 << 248)));
        // Setting the length
        hashedBytecode = hashedBytecode | bytes32(bytecodeLenInWords << 224);
    }
}
