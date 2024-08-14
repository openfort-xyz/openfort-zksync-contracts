// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.19;

import {Test} from "forge-std/Test.sol";
import {UpgradeableOpenfortFactory} from "../contracts/core/upgradeable/UpgradeableOpenfortFactory.sol";
import {UpgradeableOpenfortAccount} from "../contracts/core/upgradeable/UpgradeableOpenfortAccount.sol";


contract UpgradeableOpenfortFactoryTest is Test {

    UpgradeableOpenfortFactory factory;
    UpgradeableOpenfortAccount account;
    
    address public admin = address(1);
    // address public owner;
    // address public accountImplementation;
    // uint256 public recoveryPeriod;
    // uint256 public securityPeriod;
    // uint256 public securityWindow;
    // uint256 public lockPeriod;
    // address public initialGuardian;


    function setUp() public {
        account = new UpgradeableOpenfortAccount();
    }


    function testCreateAccountWithNonce() public {
        factory = new UpgradeableOpenfortFactory(
            address(account),
            0x9c1a3d7C98dBF89c7f5d167F2219C29c2fe775A7,
            100,
            10,
            10,
            200,
            0xBC989fDe9e54cAd2aB4392Af6dF60f04873A033A
        );
        factory.createAccountWithNonce(
            admin,
            bytes32(uint256(1)),
            false
        );
    }
}