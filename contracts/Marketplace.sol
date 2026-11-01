// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "./MarketBase.sol";
contract Marketplace is MarketBase {
    enum Status { None, Active, Sold, Cancelled }
    struct Listing { address seller; address collection; uint256 tokenId; uint256 price; uint64 expiresAt; uint256 revision; uint256 feeBps; Status status; }
    uint256 public listingCount;
    mapping(uint256=>Listing) private listings;
    event ListingCreated(uint256 indexed id,address indexed seller,address indexed collection,uint256 tokenId,uint256 price,uint64 expiresAt,uint256 feeBps);
    event ListingUpdated(uint256 indexed id,uint256 price,uint64 expiresAt,uint256 revision);
    event ListingCancelled(uint256 indexed id,address recipient);
    event SaleCompleted(uint256 indexed id,address indexed seller,address indexed buyer,address recipient,address collection,uint256 tokenId,uint256 grossPrice,uint256 fee,uint256 revision);
    constructor(address admin,address router) MarketBase(admin,router) {}
    function getListing(uint256 id) external view returns(Listing memory) { return listings[id]; }
    function _validate(uint256 price,uint64 end) private view { require(price>0 && price<=1e30,"Invalid price"); require(end>block.timestamp && end<=block.timestamp+365 days,"Invalid expiry"); }
    function createListing(address collection,uint256 tokenId,uint256 price,uint64 expiresAt) external nonReentrant live returns(uint256 id) {
        _validate(price,expiresAt); _take(collection,tokenId); id=++listingCount;
        listings[id]=Listing(msg.sender,collection,tokenId,price,expiresAt,1,feeBps,Status.Active);
        emit ListingCreated(id,msg.sender,collection,tokenId,price,expiresAt,feeBps);
    }
    function updateListing(uint256 id,uint256 expectedRevision,uint256 price,uint64 expiresAt) external live {
        Listing storage l=listings[id]; require(l.seller==msg.sender,"Only seller");
        require(l.status==Status.Active && block.timestamp<l.expiresAt,"Not active"); require(l.revision==expectedRevision,"Stale quote");
        _validate(price,expiresAt); l.price=price; l.expiresAt=expiresAt; ++l.revision; emit ListingUpdated(id,price,expiresAt,l.revision);
    }
    function buy(uint256 id,uint256 expectedRevision,address recipient) external payable nonReentrant live {
        Listing storage l=listings[id]; require(l.status==Status.Active && block.timestamp<l.expiresAt,"Not active");
        require(!blockedTokens[l.collection][l.tokenId],"NFT blocked");
        require(l.revision==expectedRevision,"Stale quote"); require(msg.sender!=l.seller,"Self purchase");
        require(msg.value==l.price,"Exact payment required"); require(recipient!=address(0) && recipient!=address(this),"Invalid recipient");
        l.status=Status.Sold; uint256 fee=_credit(l.seller,msg.value,l.feeBps);
        IERC721(l.collection).safeTransferFrom(address(this),recipient,l.tokenId);
        emit SaleCompleted(id,l.seller,msg.sender,recipient,l.collection,l.tokenId,msg.value,fee,l.revision);
    }
    function cancelListing(uint256 id,address recipient) external nonReentrant {
        Listing storage l=listings[id]; require(l.seller==msg.sender,"Only seller"); require(l.status==Status.Active,"Not active");
        require(recipient!=address(0) && recipient!=address(this),"Invalid recipient"); l.status=Status.Cancelled;
        IERC721(l.collection).safeTransferFrom(address(this),recipient,l.tokenId); emit ListingCancelled(id,recipient);
    }
}
