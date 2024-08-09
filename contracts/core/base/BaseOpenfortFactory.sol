// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.19;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IBaseOpenfortFactory} from "../../interfaces/IBaseOpenfortFactory.sol";

/**
 * @title BaseOpenfortFactory (Non-upgradeable)
 * @notice Contract to create an on-chain factory to deploy new OpenfortAccounts.
 * It inherits from:
 *  - IBaseOpenfortFactory
 *  - Ownable2Step
 */
abstract contract BaseOpenfortFactory is IBaseOpenfortFactory, Ownable2Step {
    address internal _implementation;

    error InsecurePeriod();

    constructor(address _owner, address _accountImplementation) {
        if (_owner == address(0)) revert ZeroAddressNotAllowed();
        if (!Address.isContract(_accountImplementation)) revert NotAContract();
        _transferOwnership(_owner);
        _implementation = _accountImplementation;
    }

    /**
     * @dev Returns the current implementation address.
     */
    function implementation() external view virtual override returns (address) {
        return _implementation;
    }
}
