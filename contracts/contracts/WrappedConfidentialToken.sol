// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {ERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/token/ERC7984.sol";
import {ERC20ToERC7984Wrapper} from "@iexec-nox/nox-confidential-contracts/contracts/token/extensions/ERC20ToERC7984Wrapper.sol";

/**
 * @title WrappedConfidentialToken
 * @notice ERC-20 to ERC-7984 wrapper backed by the official iExec Nox contracts.
 */
contract WrappedConfidentialToken is ERC20ToERC7984Wrapper {
    constructor(
        IERC20 underlyingToken,
        string memory name_,
        string memory symbol_,
        string memory contractURI_
    ) ERC7984(name_, symbol_, contractURI_) ERC20ToERC7984Wrapper(underlyingToken) {}
}
