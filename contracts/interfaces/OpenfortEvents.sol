// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.19;

interface OpenfortEvents {
    event AccountImplementationDeployed(address indexed creator);
    event SessionKeyRegistered(address indexed key);
    event SessionKeyRevoked(address indexed key);
    event EntryPointUpdated(address oldEntryPoint, address newEntryPoint);

    // Paymaster specifics

    /**
     * @notice Throws when trying to withdraw more than balance available
     * @param amountRequired required balance
     * @param currentBalance available balance
     */
    error InsufficientBalance(uint256 amountRequired, uint256 currentBalance);
}