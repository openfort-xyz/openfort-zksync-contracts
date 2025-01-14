// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

// TimestampAsserter is a deployed contract required to validate session key
// in the validateTransaction hook of BaseOpenfortAccount.sol
// where context variables like `block.timestamp` are not accessible.
interface ITimestampAsserter {
    function assertTimestampInRange(uint256 start, uint256 end) external view;
}
