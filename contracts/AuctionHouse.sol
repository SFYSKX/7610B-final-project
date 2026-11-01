// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "./MarketBase.sol";
contract AuctionHouse is MarketBase {
    enum Status { None, Active, Settled, Cancelled }
    struct Auction { address seller; address collection; uint256 tokenId; uint256 reservePrice; uint256 minIncrement; uint64 endTime; uint256 feeBps; address highestBidder; uint256 highestBid; Status status; address entitledRecipient; bool assetClaimed; }
    address public settlementKeeper;
    error SettlementOnly();
    event SettlementKeeperConfigured(address indexed keeper);
    function setSettlementKeeper(address keeper) external onlyOwner { settlementKeeper=keeper; emit SettlementKeeperConfigured(keeper); }
    uint256 public auctionCount;
    mapping(uint256=>Auction) private auctions;
    mapping(address=>uint256) public refundCredit;
    uint256 public totalRefundLiability;
    uint256 public activeHighestBidTotal;
    event AuctionCreated(uint256 indexed id,address indexed seller,address indexed collection,uint256 tokenId,uint256 reservePrice,uint256 minIncrement,uint64 endTime,uint256 feeBps);
    event BidPlaced(uint256 indexed id,address indexed bidder,uint256 amount);
    event AuctionCancelled(uint256 indexed id);
    event AuctionSettled(uint256 indexed id,address indexed seller,address indexed winner,uint256 price,uint256 fee);
    event NFTClaimed(uint256 indexed id,address indexed account,address indexed recipient);
    event RefundWithdrawn(address indexed account,address indexed recipient,uint256 amount);
    constructor(address admin,address router) MarketBase(admin,router) {}
    function getAuction(uint256 id) external view returns(Auction memory) { return auctions[id]; }
    function createAuction(address collection,uint256 tokenId,uint256 reservePrice,uint256 minIncrement,uint64 endTime) external nonReentrant live returns(uint256 id) {
        require(reservePrice>0 && reservePrice<=1e30 && minIncrement>0 && minIncrement<=1e30,"Invalid price");
        require(endTime>block.timestamp && endTime<=block.timestamp+30 days,"Invalid end"); _take(collection,tokenId);
        id=++auctionCount; Auction storage a=auctions[id]; a.seller=msg.sender; a.collection=collection; a.tokenId=tokenId;
        a.reservePrice=reservePrice; a.minIncrement=minIncrement; a.endTime=endTime; a.feeBps=feeBps; a.status=Status.Active;
        emit AuctionCreated(id,msg.sender,collection,tokenId,reservePrice,minIncrement,endTime,feeBps);
    }
    function bid(uint256 id) external payable nonReentrant live {
        Auction storage a=auctions[id]; require(a.status==Status.Active && block.timestamp<a.endTime,"Auction not live");
        require(!blockedTokens[a.collection][a.tokenId],"NFT blocked");
        require(msg.sender!=a.seller && msg.sender!=a.highestBidder,"Invalid bidder");
        require(msg.value<=1e30 && msg.value>0 && msg.value>=(a.highestBid==0?a.reservePrice:a.highestBid+a.minIncrement),"Bid too low");
        if(a.highestBid>0){refundCredit[a.highestBidder]+=a.highestBid;totalRefundLiability+=a.highestBid;activeHighestBidTotal-=a.highestBid;}
        a.highestBidder=msg.sender;a.highestBid=msg.value;activeHighestBidTotal+=msg.value;emit BidPlaced(id,msg.sender,msg.value);
    }
    function cancelAuction(uint256 id) external {
        Auction storage a=auctions[id];require(a.seller==msg.sender,"Only seller"); require(a.status==Status.Active && a.highestBid==0,"Cannot cancel");
        a.status=Status.Cancelled;a.entitledRecipient=a.seller;emit AuctionCancelled(id);
    }
    function settleAuction(uint256 id) external nonReentrant {
        if(msg.sender!=settlementKeeper && msg.sender!=owner()) revert SettlementOnly();
        Auction storage a=auctions[id];require(a.status==Status.Active && block.timestamp>=a.endTime,"Not ready");a.status=Status.Settled;
        uint256 fee;
        if(a.highestBid>0){activeHighestBidTotal-=a.highestBid;fee=_credit(a.seller,a.highestBid,a.feeBps);a.entitledRecipient=a.highestBidder;}
        else a.entitledRecipient=a.seller;
        emit AuctionSettled(id,a.seller,a.highestBidder,a.highestBid,fee);
    }
    function claimNFT(uint256 id,address recipient) external nonReentrant {
        Auction storage a=auctions[id];require(a.entitledRecipient==msg.sender && !a.assetClaimed,"No NFT entitlement");
        require(recipient!=address(0) && recipient!=address(this),"Invalid recipient");a.assetClaimed=true;
        IERC721(a.collection).safeTransferFrom(address(this),recipient,a.tokenId);emit NFTClaimed(id,msg.sender,recipient);
    }
    function withdrawRefund(address payable recipient) external nonReentrant {
        require(recipient!=address(0),"Invalid recipient");uint256 amount=refundCredit[msg.sender];require(amount>0,"No refund");
        refundCredit[msg.sender]=0;totalRefundLiability-=amount;(bool ok,)=recipient.call{value:amount}("");require(ok,"Payment failed");emit RefundWithdrawn(msg.sender,recipient,amount);
    }
}
