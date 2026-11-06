// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./DemoNFT.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract ReentrantMintOwner is IERC721Receiver {
    DemoNFT private immutable nft;
    bool public attempted;
    bool public nestedMintSucceeded;

    constructor(DemoNFT collection) { nft = collection; }

    function issueBatch() external {
        nft.mintBatch(address(this), 2, "batch");
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        if (!attempted) {
            attempted = true;
            try nft.mint(address(this), "nested") {
                nestedMintSucceeded = true;
            } catch {}
        }
        return IERC721Receiver.onERC721Received.selector;
    }
}
