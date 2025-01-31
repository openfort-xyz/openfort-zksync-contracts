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
import {Ownable} from "solady/src/auth/Ownable.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


struct MinimalTransaction {
    address from;
    address to;
    bytes data;
    uint256 value;
    uint256 maxFeePerGas;
    uint256 gasLimit;
    uint256 nonce;
}

contract MultiTokenPaymaster is IPaymaster, Ownable {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    address constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    uint256 constant ETH_DECIMALS = 18;

    error UnauthorizedWithdraw();
    event BalanceWithdrawn(address indexed user, uint256 indexed amount);
    event ERC20PaymasterUsed(address indexed user, address indexed token);

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader can call this method");
        _;
    }

    constructor(address _owner) {
        _initializeOwner(_owner);
    }

    function validateAndPayForPaymasterTransaction(bytes32, bytes32, Transaction calldata _transaction)
        external
        payable
        override
        onlyBootloader
        returns (bytes4 magic, bytes memory context)
    {
        require(_transaction.paymasterInput.length >= 4, "InvalidInputLength");
        bytes4 paymasterInputSelector = bytes4(_transaction.paymasterInput[0:4]);
        require(
            paymasterInputSelector == IPaymasterFlow.approvalBased.selector
                || paymasterInputSelector == IPaymasterFlow.general.selector,
            "Unsupported paymaster flow"
        );
        address token = ETH;
        uint256 rate = 1;
        uint256 requiredEth = _transaction.gasLimit * _transaction.maxFeePerGas;
        if (paymasterInputSelector == IPaymasterFlow.approvalBased.selector) {

            // Note: rate is the ETH/TOKEN price
            (token,,,, rate,) =
                abi.decode(_transaction.paymasterInput[4:], (address, uint256, uint256, uint256, uint256, uint256));

            address userAddress = address(uint160(_transaction.from));
            uint256 providedAllowance = IERC20(token).allowance(userAddress, address(this));
            uint256 requiredToken = (requiredEth * rate) / (10 ** ETH_DECIMALS);

            if (providedAllowance < requiredToken) {
                revert("Insufficient allowance");
            }
            IERC20(token).safeTransferFrom(userAddress, address(this), requiredToken);
        }
        uint256 length = _transaction.paymasterInput.length;
        // regardless of the flow, signature is always at the end of the paymasterInput
        bytes memory signature = _transaction.paymasterInput[length - 31 - 65:length - 31];
        if (
            isValidSignature(
                signature,
                MinimalTransaction({
                    from: address(uint160(_transaction.from)),
                    to: address(uint160(_transaction.to)),
                    data: _transaction.data,
                    value: _transaction.value,
                    maxFeePerGas: _transaction.maxFeePerGas,
                    gasLimit: _transaction.gasLimit,
                    nonce: _transaction.nonce
                }),
                token,
                rate
            )
        ) {
            magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
        }
        payGas(requiredEth);
        context = abi.encode(token, rate);
    }

    function payGas(uint256 _eth_fee) internal {
        (bool success,) = payable(BOOTLOADER_FORMAL_ADDRESS).call{value: _eth_fee}("");
        require(success, "gas payment failed");
    }

    /**
     * @notice Transfers the remaining ETH balance of the Paymaster back to the user after a transaction has been executed.
     * @param _transaction The transaction object.
     */
    /// @inheritdoc IPaymaster
    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult,
        uint256 _maxRefundedGas
    ) external payable onlyBootloader {
        (address tokenAddress, uint256 rate) = abi.decode(_context, (address, uint256));
        if (tokenAddress != ETH) {
            address userAddress = address(uint160(_transaction.from));
            uint256 refundTokenAmount = ((_maxRefundedGas * _transaction.maxFeePerGas) * rate) / ETH_DECIMALS;
            IERC20(tokenAddress).safeTransfer(userAddress, refundTokenAmount);
            emit ERC20PaymasterUsed(userAddress, tokenAddress);
        }
    }

    function isValidSignature(
        bytes memory _signature,
        MinimalTransaction memory _transaction,
        address _token,
        uint256 _rate
    ) public view returns (bool) {
        bytes memory encodedData = abi.encodePacked(
            _transaction.from,
            _transaction.to,
            _transaction.data,
            _transaction.value,
            _transaction.maxFeePerGas,
            _transaction.gasLimit,
            _transaction.nonce,
            _token,
            _rate
        );
        bytes32 messageHash = keccak256(encodedData);
        bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(messageHash);
        (address recoveredAddress, ECDSA.RecoverError error2) = ECDSA.tryRecover(ethSignedMessageHash, _signature);

        if (error2 != ECDSA.RecoverError.NoError) {
            return false;
        }
        return recoveredAddress == owner();
    }


    /**
     * @notice Withdraw paymaster funds as owner
     * @param to address     - Token receiver address
     * @param amount uint256 - Amount to be withdrawn
     * @dev Only owner address can call this method
     */
    function withdraw(address to, uint256 amount) external onlyOwner {
        // Send paymaster funds to the given address
        (bool success, ) = payable(to).call{value: amount}("");
        if (!success) revert UnauthorizedWithdraw();
        emit BalanceWithdrawn(to, amount);
    }

    /**
     * @notice Withdraw paymaster token funds as owner
     * @param token address  - Token address to withdraw
     * @param to    address  - Token receiver address
     * @param amount uint256 - Amount to be withdrawn
     * @dev Only owner address can call this method
     */
    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        // Send paymaster funds to the given address
        IERC20(token).safeTransfer(to, amount);
    }

    receive() external payable {}
}
