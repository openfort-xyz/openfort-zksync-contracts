pragma solidity ^0.8.0;

import {
    IPaymaster,
    ExecutionResult,
    PAYMASTER_VALIDATION_SUCCESS_MAGIC
} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import {
    TransactionHelper,
    Transaction
} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

import {BOOTLOADER_FORMAL_ADDRESS} from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract GeneralPaymaster is IPaymaster {
    using ECDSA for bytes32;

    address public owner;

    event NewOwner();

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader can call this method");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner is allowed");
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    function setNewOwner(address newOwner) external onlyOwner {
        owner = newOwner;
        emit NewOwner();
    }

    function validateAndPayForPaymasterTransaction(bytes32, bytes32, Transaction calldata _transaction)
        external
        payable
        override
        onlyBootloader
        returns (bytes4 magic, bytes memory /* context */ )
    {
        require(_transaction.paymasterInput.length >= 4, "InvalidInputLength");
        bytes4 paymasterInputSelector = bytes4(_transaction.paymasterInput[0:4]);
        require(paymasterInputSelector == IPaymasterFlow.general.selector, "Unsupported paymaster flow");

        bytes memory signature = abi.decode(_transaction.paymasterInput[4:], (bytes));

        if (
            isValidSignature(
                signature,
                address(uint160(_transaction.from)),
                address(uint160(_transaction.to)),
                _transaction.data,
                _transaction.value,
                _transaction.maxFeePerGas,
                _transaction.gasLimit
            )
        ) {
            magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
        }

        uint256 eth_fee = _transaction.gasLimit * _transaction.maxFeePerGas;
        payGas(eth_fee);
    }

    function payGas(uint256 _eth_fee) internal {
        (bool success,) = payable(BOOTLOADER_FORMAL_ADDRESS).call{value: _eth_fee}("");
        require(success, "gas payment failed");
    }

    /**
     * @notice Transfers the remaining ETH balance of the Paymaster back to the user after a transaction has been executed.
     * @param _transaction The transaction object.
     */
    function postTransaction(
        bytes calldata, /*_context*/
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult, /*_txResult*/
        uint256 /*_maxRefundedGas*/
    ) external payable override onlyBootloader {}

    function isValidSignature(
        bytes memory _signature,
        address _from,
        address _to,
        bytes calldata _data,
        uint256 _value,
        uint256 _maxFeePerGas,
        uint256 _gasLimit
    ) public view returns (bool) {
        bytes32 messageHash = keccak256(abi.encodePacked(_from, _to, _data, _value, _maxFeePerGas, _gasLimit));

        bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(messageHash);

        (address recoveredAddress, ECDSA.RecoverError error2) = ECDSA.tryRecover(ethSignedMessageHash, _signature);
        if (error2 != ECDSA.RecoverError.NoError) {
            return false;
        }

        return recoveredAddress == owner;
    }

    receive() external payable {}
}
