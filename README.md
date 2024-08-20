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



## Development

### Build
```
  git clone https://github.com/openfort-xyz/openfort-contracts.git && cd openfort-contracts
  yarn
  yarn hardhat compile
```

### Deploy

```
yarn hardhat deploy-zksync --network <NETWORK> --script <deploymentScript.ts>
```

NETWORK must be a `key` of the `networks` object in the `hardhat.config.ts` ans `deploymentScript` must be a script in the `deploy` directory.

Openfort Accounts deployments on [Sophon](https://explorer.testnet.sophon.xyz/):

Associated account to `private_key` must be whitelisted in the Sophon paymaster.
No SOPH$ token required.

```
export WALLET_PRIVATE_KEY=<private_key> # Associated account to private_key must be whitelisted in the Sophon paymaster. No SOPH$ token required.
yarn hardhat deploy-zksync --network zkSophonTestnet --script deployAccountOnSophon.ts

export ACCOUNT_IMPLEMENTATION_ADDRESS=<deployed_account>
yarn hardhat deploy-zksync --network zkSophonTestnet --script deployFactoryOnSophon.ts
```

### Interact

```
cast send <factory_address> "createAccountWithNonce(address,bytes32,bool)" <admin_address> $(cast --to-bytes32 <nonce>)  "true"  --rpc-url https://rpc.testnet.sophon.xyz  --chain 531050104 --private-key $WALLET_PRIVATE_KEY
```

Note: The account address is the first parameter of the [AccountCreated event](https://explorer.testnet.sophon.xyz/address/0xc5974add8EAC9a6f74b539be470BF934641DC85E#events). Calling the `createAcccountWithNonce` with same params will trigger the event only once.


## Narrative

ZKsync is a Zero-knowledge Rollup for Scalling Ethereum featuring its own zkEVM, which runs bytecode distinct from Ethereum's EVM.
While [99% of Ethereum projects can redeploy on zkSync without needing to refactor or re-audit their code](https://github.com/matter-labs/era-zk_evm), Account Abstraction contracts fall into the remaining 1%.

zkSync natively supports Account Abstraction, eliminating the need for ERC-4337 and its EntryPoint contract.

Account features like session keys, guardians, and the upgradeability stratregy, MUST conform with [openfort-contracts](https://github.com/openfort-xyz/openfort-contracts).