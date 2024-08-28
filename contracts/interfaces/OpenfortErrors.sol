// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.19;

interface OpenfortErrors {
    /// @notice Error when a parameter is 0.
    error ZeroValueNotAllowed();

    /// @notice Error when a function requires msg.value to be different than 0
    error MustSendNativeToken();

    /// @notice Error when a function requires msg.value to be different than owner()
    error OwnerNotAllowed();

    /// @notice Error when an address is not a contract.
    error NotAContract();


    /// @notice Error when session key is out of time range

    error SessionKeyOutOfTimeRange();

    error ZeroAddressNotAllowed();
    error NotOwnerOrEntrypoint();
    error NotOwner();
    error InvalidParameterLength();
}
