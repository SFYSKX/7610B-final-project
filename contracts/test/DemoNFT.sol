// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract DemoNFT is ERC721URIStorage,Ownable {
    uint256 public nextTokenId;
    event DemoMinted(address indexed recipient,uint256 indexed tokenId);
    constructor() ERC721("Campus Digital Objects","CDO") Ownable(msg.sender) {}
    function mint(address recipient,string calldata uri) external onlyOwner returns(uint256 id){require(recipient!=address(0) && bytes(uri).length<=4096,"Invalid asset");id=++nextTokenId;_safeMint(recipient,id);_setTokenURI(id,uri);emit DemoMinted(recipient,id);}
}
