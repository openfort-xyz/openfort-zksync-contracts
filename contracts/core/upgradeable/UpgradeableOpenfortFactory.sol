// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.19;

import {
    IContractDeployer, DEPLOYER_SYSTEM_CONTRACT
} from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import {SystemContractsCaller} from
    "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

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

    bytes32 internal upgradeableProxyCodeHash;

    address public timestampAsserter;

    error TooManyInitialGuardians();

    /**
     * @dev Emitted when the initial guardian is changed.
     */
    event InitialGuardianUpdated(address indexed oldInitialGuardian, address indexed newInitialGuardian);

    /**
     * @dev Emitted when the timestamp asserter is changed.
     */
    event TimestampAsserterUpdated(address indexed oldTimestampAsserter, address indexed newTimestampAsserter);

    constructor(
        address _timestampAsserter,
        address _owner,
        bytes32 _upgradeableProxyCodeHash,
        address _accountImplementation,
        uint256 _recoveryPeriod,
        uint256 _securityPeriod,
        uint256 _securityWindow,
        uint256 _lockPeriod,
        address _initialGuardian
    ) BaseOpenfortFactory(_owner, _accountImplementation) {
        // required in the Openfort BaseAccount to validate session key at transaction validation time
        // where environment variables like block.timestamp are not available
        timestampAsserter = _timestampAsserter;

        upgradeableProxyCodeHash = _upgradeableProxyCodeHash;

        if (_lockPeriod < _recoveryPeriod || _recoveryPeriod < _securityPeriod + _securityWindow) {
            revert InsecurePeriod();
        }
        recoveryPeriod = _recoveryPeriod;
        securityPeriod = _securityPeriod;
        securityWindow = _securityWindow;
        lockPeriod = _lockPeriod;
        if (_initialGuardian == address(0)) revert ZeroAddressNotAllowed();
        initialGuardian = _initialGuardian;
    }

    function updateInitialGuardian(address _newInitialGuardian) external onlyOwner {
        if (_newInitialGuardian == address(0)) revert ZeroAddressNotAllowed();
        initialGuardian = _newInitialGuardian;
        emit InitialGuardianUpdated(initialGuardian, _newInitialGuardian);
    }

    function updateTimestampAsserter(address _newTimestampAsserter) external onlyOwner {
        if (_newTimestampAsserter == address(0)) revert ZeroAddressNotAllowed();
        timestampAsserter = _newTimestampAsserter;
        emit TimestampAsserterUpdated(timestampAsserter, _newTimestampAsserter);
    }


    /*
     * @notice Deploy a new account for _admin with a _nonce.
     */
    function createAccountWithNonce(address _admin, bytes32 _nonce, bool _initializeGuardian)
        external
        returns (address account)
    {
        require(timestampAsserter != address(0), "Timestamp asserter must be set");

        bytes32 salt = keccak256(abi.encode(_admin, _nonce));
        account = getAddressWithNonce(_admin, _nonce);
        uint256 codelen;
        assembly {
            codelen := extcodesize(account)
        }
        if (codelen > 0) return account;

        (bool success, bytes memory returnData) = SystemContractsCaller.systemCallWithReturndata(
            uint32(gasleft()),
            address(DEPLOYER_SYSTEM_CONTRACT),
            uint128(0),
            abi.encodeCall(
                DEPLOYER_SYSTEM_CONTRACT.create2Account,
                (
                    salt,
                    // Contract Bytecode Hash
                    upgradeableProxyCodeHash,
                    abi.encode(_implementation, ""),
                    IContractDeployer.AccountAbstractionVersion.Version1
                )
            )
        );

        require(success, string(abi.encodePacked("Deployment Failed: ", returnData)));

        emit AccountCreated(account, _admin);

        UpgradeableOpenfortAccount(payable(account)).initialize(
            timestampAsserter,
            _admin,
            recoveryPeriod,
            securityPeriod,
            securityWindow,
            lockPeriod,
            _initializeGuardian ? initialGuardian : address(0)
        );

        return account;
    }

    /*
     * @notice Return the address of an account that would be deployed with the given _admin signer and _nonce.
     */
    function getAddressWithNonce(address _admin, bytes32 _nonce) public returns (address account) {
        bytes32 salt = keccak256(abi.encode(_admin, _nonce));

        (bool success, bytes memory returnData) = SystemContractsCaller.systemCallWithReturndata(
            uint32(gasleft()),
            address(DEPLOYER_SYSTEM_CONTRACT),
            uint128(0),
            abi.encodeCall(
                DEPLOYER_SYSTEM_CONTRACT.getNewAddressCreate2,
                (
                    // Deployer address
                    address(this),
                    upgradeableProxyCodeHash,
                    salt,
                    // Constructor Bytecode
                    abi.encode(_implementation, "")
                )
            )
        );
        require(success, string(abi.encodePacked("zkSync CREATE 2 address calculation failed", returnData)));
        account = abi.decode(returnData, (address));
    }
}
