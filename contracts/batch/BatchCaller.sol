// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {SystemContractHelper} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractHelper.sol";
import {EfficientCall} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/EfficientCall.sol";

// credit goes to Clave team: https://github.com/getclave/clave-contracts/blob/master/contracts/batch/BatchCaller.sol

// Each call data for batches
struct Call {
    address target; // Target contract address
    uint256 value; // Amount of ETH to send with call
    bytes callData; // Calldata to send
}


/// @title BatchCaller
/// @notice Make multiple calls in a single transaction
contract BatchCaller {
    error ReentrantCall();
    error CallFailed();
    error InvalidParameterLength();
    error OnlyDelegatecall();
 
    /// @notice Make multiple calls, ensure success if required
    /// @dev Reverts if not called via delegatecall
    /// @param calls Call[] calldata - An array of Call structs
    function batchCall(Call[] calldata calls) external {
        if (calls.length > 9) {
            revert InvalidParameterLength();
        }

        address callerAddress = SystemContractHelper.getCodeAddress();
        bool isDelegateCall = callerAddress != address(this);
        if (!isDelegateCall) {
            revert OnlyDelegatecall();
        }

        // Execute each call
        uint256 len = calls.length;
        Call calldata calli;

        for (uint256 i = 0; i < len; ) {
            calli = calls[i];
            address target = calli.target;

            if (target == callerAddress) {
                revert ReentrantCall();
            }
            uint256 value = calli.value;
            bytes calldata callData = calli.callData;

            bool success = EfficientCall.rawCall(gasleft(), target, value, callData, false);

            if (!success) {
                revert CallFailed();
            }
            unchecked {
                i++;
            }
        }
    }
}