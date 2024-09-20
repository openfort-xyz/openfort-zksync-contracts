// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.19;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {BaseRecoverableAccount} from "../base/BaseRecoverableAccount.sol";

/**
 * @title UpgradeableOpenfortAccount
 * @notice Smart contract following the ZKsync AA standard with session keys support.
 * It inherits from:
 *  - BaseRecoverableAccount
 *  - UUPSUpgradeable
 */
contract UpgradeableOpenfortAccount is BaseRecoverableAccount, UUPSUpgradeable {
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
