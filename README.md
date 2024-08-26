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


# Openfort ZKSync contracts - WORK IN PROGRESS



### Build
```
  git clone https://github.com/openfort-xyz/openfort-contracts.git && cd openfort-contracts
  yarn
  yarn hardhat compile
```


### Test


Run e2e tests on a freshly created account deployed from a fresh factory (long setup time)

```
yarn hardhat test --network <zkSophonTestnet|zkTestnet|zkSyncLocal>  --nonce <number>
```

Running tests with the `zkSyncLocal` network requires a running local zkSync node: [download](https://github.com/matter-labs/era-test-node) and run `era_test_node fork mainnet` on another terminal *before* running the tests.

Run e2e tests directly, skip deployments

```
export ACCOUNT_IMPLEMENTATION_ADDRESS=<DEPLOYED_AND_INITIALIZED_ACCOUNT>
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


## Narrative

ZKsync is a Zero-knowledge Rollup for Scalling Ethereum featuring its own zkEVM, which runs bytecode distinct from Ethereum's EVM.
While [99% of Ethereum projects can redeploy on zkSync without needing to refactor or re-audit their code](https://github.com/matter-labs/era-zk_evm), Account Abstraction contracts fall into the remaining 1%.

zkSync natively supports Account Abstraction, eliminating the need for ERC-4337 and its EntryPoint contract.

Account features like session keys, guardians, and the upgradeability stratregy, MUST conform with [openfort-contracts](https://github.com/openfort-xyz/openfort-contracts).