// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20, ERC20Burnable {
    constructor ()
        ERC20("<script>alert('hi');</script>", "TEST")
    { }

    function mint(address account, uint256 amount)
        external
    {
        require( amount < 10000 ether );

        _mint(account, amount);
    }
}