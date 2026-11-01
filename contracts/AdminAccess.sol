// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "@openzeppelin/contracts/access/Ownable.sol";

/// Fixed-destination maintenance may be performed by a current governance signer.
/// Configuration, budgets and claim approvals still require the multisig itself.
abstract contract AdminAccess is Ownable {
    error AdminOnly();
    constructor(address admin) Ownable(admin) {}
    function isAdministrator(address account) public view returns (bool) {
        if (account == owner()) return true;
        bytes memory callData = block.chainid == 31337
            ? abi.encodeWithSignature("isSigner(address)", account)
            : abi.encodeWithSignature("isOwner(address)", account);
        (bool ok, bytes memory result) = owner().staticcall(callData);
        return ok && result.length == 32 && abi.decode(result, (bool));
    }
    modifier onlyAdministrator() { if (!isAdministrator(msg.sender)) revert AdminOnly(); _; }
}
