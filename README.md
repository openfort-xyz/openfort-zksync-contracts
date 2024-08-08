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

### Install [foundry-zksync](https://github.com/openfort-xyz/openfort-zksync-contracts)


### Build
```
  git clone https://github.com/openfort-xyz/openfort-contracts.git && cd openfort-contracts
  yarn
  forge install
  forge build --zksync
```



## Narrative

ZKsync is a Zero-knowledge Rollup for Scalling Ethereum featuring its own zkEVM, which runs bytecode distinct from Ethereum's EVM.
While [99% of Ethereum projects can redeploy on zkSync without needing to refactor or re-audit their code](https://github.com/matter-labs/era-zk_evm), Account Abstraction contracts fall into the remaining 1%.

zkSync natively supports Account Abstraction, eliminating the need for ERC-4337 and its EntryPoint contract.

Account features like session keys, guardians, and the upgradeability stratregy, MUST conform with [openfort-contracts](https://github.com/openfort-xyz/openfort-contracts).