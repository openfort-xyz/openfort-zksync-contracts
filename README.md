![Openfort Protocol][banner-image]

<div align="center">
  <h4>
    <a href="https://www.openfort.xyz/">
      Website
    </a>
    <span> | </span>
    <a href="https://www.openfort.xyz/docs">
      Documentation
    </a>
    <span> | </span>
    <a href="https://www.openfort.xyz/docs/api">
      API Docs
    </a>
    <span> | </span>
    <a href="https://twitter.com/openfortxyz">
      Twitter
    </a>
  </h4>
</div>

[banner-image]: .github/img/OpenfortRed.png


# Openfort ZKSync contracts

## Overview


[Openfort Smart Accounts](https://github.com/openfort-xyz/openfort-contracts) for zkSync.


zkSync is a zero-knowledge Ethereum rollup featuring its own zkEVM, which operates with bytecode distinct from Ethereum's EVM. While [99% of Ethereum projects can be redeployed on zkSync without requiring refactoring or re-auditing](https://github.com/matter-labs/era-zk_evm), Account Abstraction contracts fall into the remaining 1%.

Unlike traditional Ethereum setups, zkSync natively supports Account Abstraction, eliminating the need for ERC-4337 and its associated EntryPoint contract.
Account features like session keys, guardians, and contracts upgradeability stratregy, MUST conform with [Openfort Smart Accounts](https://github.com/openfort-xyz/openfort-contracts).

This repository contains only end to end tests because openfort-contracts is already heavily tested and audited.


### Build
```
  git clone https://github.com/openfort-xyz/openfort-zksync-contracts.git && cd openfort-zksync-contracts
  yarn
  yarn hardhat compile
```


### Test


Run e2e tests on a freshly created account deployed from a fresh factory (long setup time)

To test on Sophon testnet:
```
export WALLET_PRIVATE_KEY=0x...
export export SOPHON_TESTNET_PAYMASTER_ADDRESS=0x...
```

To test on zkTestnet (zkSync Sepolia):
```
export WALLET_PRIVATE_KEY=0x... // account must have native sepolia to pay for the deployments
```

No env required to test on zkSyncLocal (local node)


```
yarn hardhat test --network <zkSophonTestnet|zkTestnet|zkSyncLocal>  --nonce <number> // nonce gives predictive smart account address
```

Running tests with the `zkSyncLocal` network requires a running local zkSync node: [download](https://github.com/matter-labs/era-test-node) and run `era_test_node fork https://sepolia.era.zksync.dev` on another terminal *before* running the tests.

Run e2e tests directly, skip deployments

```
export ACCOUNT_ADDRESS=<ACCOUNT_ADDRESS>
yarn hardhat test --network <zkSophonTestnet|zkTestnet|zkSyncLocal> --skip-deployments
```

### Deploy

```
WALLET_PRIVATE_KEY= # account must have positive balance to deploy on zkTestnet (Sepolia) OR be whitelisted on Sophon Paymaster to deploy on Sophon testnet

SOPHON_TESTNET_PAYMASTER_ADDRESS= # only required to deploy on Sophon
```

[UpgradeableOpenfortAccount](./contracts/core/upgradeable/UpgradeableOpenfortAccount.sol)
```
yarn hardhat deploy-account --network <zkSophonTestnet|zkTestnet|zkSyncLocal>
```


[UpgradeableOpenfortFactory](./contracts/core/upgradeable/UpgradeableOpenfortFactory.sol)
```
# account is optional. script will deploy one if not provided. 
yarn hardhat deploy-factory --account <DEPLOYED_ACCOUNT> --network <zkSophonTestnet|zkTestnet|zkSyncLocal>
```


### Interact

Call `createAccountWithNounce` factory function to deploy an account proxy and initialize it with the account implementation

```
yarn hardhat create-account --factory <FACTORY> --implementation <ACCOUNT_IMPLEMENTATION> --nonce <number> --network <zkSophonTestnet|zkTestnet|zkSyncLocal>
```


### Helper

Compute the address of any account

https://docs.zksync.io/build/developer-reference/ethereum-differences/evm-instructions#address-derivation
```
yarn hardhat get-account --factory <FACTORY> --implementation <ACCOUNT_IMPLEMENTATION> --nonce <number>
```
