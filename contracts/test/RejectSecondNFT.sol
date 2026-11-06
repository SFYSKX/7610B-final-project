// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
contract RejectSecondNFT is IERC721Receiver {
    uint256 public received;
    function onERC721Received(address,address,uint256,bytes calldata) external returns(bytes4){
        require(++received<2,"Second NFT rejected");
        return IERC721Receiver.onERC721Received.selector;
    }
}
