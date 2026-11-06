// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract DemoNFT is ERC721URIStorage,Ownable,ReentrancyGuard {
    uint256 public nextTokenId;
    uint256 public constant MINT_BATCH_LIMIT=10;
    event DemoMinted(address indexed recipient,uint256 indexed tokenId);
    constructor() ERC721("Campus Digital Objects","CDO") Ownable(msg.sender) {}
    function mint(address recipient,string calldata uri) external onlyOwner nonReentrant returns(uint256 id){return _mintOne(recipient,uri);}
    // One wallet confirmation; any rejected safe transfer rolls back the whole batch.
    function mintBatch(address recipient,uint256 count,string calldata uri) external onlyOwner nonReentrant returns(uint256 firstId,uint256 lastId){
        require(count>0 && count<=MINT_BATCH_LIMIT,"Invalid mint count");
        firstId=nextTokenId+1;
        for(uint256 i;i<count;++i)_mintOne(recipient,uri);
        lastId=nextTokenId;
    }
    function _mintOne(address recipient,string memory uri) private returns(uint256 id){require(recipient!=address(0) && bytes(uri).length<=4096,"Invalid asset");id=++nextTokenId;_safeMint(recipient,id);_setTokenURI(id,uri);emit DemoMinted(recipient,id);}
}
