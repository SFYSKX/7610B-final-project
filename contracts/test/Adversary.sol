// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
contract Adversary {
    bool public rejectETH;
    address public reentryTarget;
    bytes public reentryData;
    bool public reentrySucceeded;
    function configure(bool reject,address target,bytes calldata data) external {rejectETH=reject;reentryTarget=target;reentryData=data;}
    function invoke(address target,bytes calldata data) external payable returns(bytes memory result){bool ok;(ok,result)=target.call{value:msg.value}(data);if(!ok){assembly{revert(add(result,32),mload(result))}}}
    receive() external payable {require(!rejectETH,"Reject ETH");if(reentryTarget!=address(0)){(reentrySucceeded,)=reentryTarget.call(reentryData);}}
    // No ERC721 receiver: intentionally refuses safe deliveries.
}
