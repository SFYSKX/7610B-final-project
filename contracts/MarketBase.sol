// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "./AdminAccess.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
interface IFeeRouter { function depositFees() external payable; }

abstract contract MarketBase is AdminAccess, ReentrancyGuard, IERC721Receiver {
    uint256 public constant API_VERSION = 2;
    uint256 public constant MAX_FEE_BPS = 500;
    uint256 public constant MAX_ADMIN_BATCH = 100;
    error InvalidBatchSize();
    error BatchLengthMismatch();
    function _checkBatch(uint256 length) private pure {
        if (length == 0 || length > MAX_ADMIN_BATCH) revert InvalidBatchSize();
    }
    function setTokensBlocked(address collection, uint256[] calldata tokenIds, bool blocked) external onlyOwner {
        _checkBatch(tokenIds.length);
        require(collection.code.length > 0, "Invalid collection");
        for (uint256 i; i < tokenIds.length; ++i) {
            blockedTokens[collection][tokenIds[i]] = blocked;
            emit TokenConfigured(collection, tokenIds[i], blocked);
        }
    }
    function setCollections(address[] calldata collections, bool[] calldata allowed) external onlyOwner {
        _checkBatch(collections.length);
        if (collections.length != allowed.length) revert BatchLengthMismatch();
        for (uint256 i; i < collections.length; ++i) _setCollection(collections[i], allowed[i]);
    }
    address public immutable feeRouter;
    uint256 public feeBps = 100;
    bool public paused;
    mapping(address => bool) public allowedCollections;
    mapping(address => mapping(uint256 => bool)) public blockedTokens;
    event TokenConfigured(address indexed collection, uint256 indexed tokenId, bool blocked);
    function setTokenBlocked(address collection, uint256 tokenId, bool blocked) external onlyOwner {
        require(collection.code.length > 0, "Invalid collection");
        blockedTokens[collection][tokenId] = blocked; emit TokenConfigured(collection, tokenId, blocked);
    }
    mapping(address => uint256) public sellerCredit;
    uint256 public totalSellerLiability;
    uint256 public pendingFees;
    address private expectedCollection;
    address private expectedFrom;
    uint256 private expectedToken;
    event CollectionConfigured(address indexed collection, bool allowed);
    event FeeConfigured(uint256 bps);
    event PauseConfigured(bool paused);
    event SellerCreditWithdrawn(address indexed account, address indexed recipient, uint256 amount);
    event FeesFlushed(uint256 amount);
    constructor(address admin, address router) AdminAccess(admin) {
        require(admin.code.length > 0 && router.code.length > 0, "Invalid config"); feeRouter = router;
    }
    modifier live() { require(!paused, "New business paused"); _; }
    function setCollection(address collection, bool allowed) external onlyOwner {
        _setCollection(collection, allowed);
    }
    function _setCollection(address collection, bool allowed) private {
        require(collection.code.length > 0, "Invalid collection");
        if (allowed) require(IERC721(collection).supportsInterface(type(IERC721).interfaceId), "Not ERC721");
        allowedCollections[collection] = allowed; emit CollectionConfigured(collection, allowed);
    }
    function setFeeBps(uint256 bps) external onlyOwner { require(bps <= MAX_FEE_BPS, "Fee too high"); feeBps=bps; emit FeeConfigured(bps); }
    function setPaused(bool value) external onlyOwner { paused=value; emit PauseConfigured(value); }
    function _take(address collection, uint256 tokenId) internal {
        require(allowedCollections[collection], "Unsupported collection");
        require(!blockedTokens[collection][tokenId], "NFT blocked");
        require(IERC721(collection).ownerOf(tokenId)==msg.sender, "Not NFT owner");
        expectedCollection=collection; expectedFrom=msg.sender; expectedToken=tokenId;
        IERC721(collection).safeTransferFrom(msg.sender,address(this),tokenId);
        require(IERC721(collection).ownerOf(tokenId)==address(this), "Custody failed");
        expectedCollection=address(0); expectedFrom=address(0);
    }
    function onERC721Received(address operator, address from, uint256 id, bytes calldata) external view returns(bytes4) {
        require(msg.sender==expectedCollection && from==expectedFrom && id==expectedToken && operator==address(this), "Unexpected NFT");
        return IERC721Receiver.onERC721Received.selector;
    }
    function _credit(address seller, uint256 price, uint256 bps) internal returns(uint256 fee) {
        fee=price*bps/10000; pendingFees+=fee; sellerCredit[seller]+=price-fee; totalSellerLiability+=price-fee;
    }
    function withdrawSellerCredit(address payable recipient) external nonReentrant {
        require(recipient!=address(0), "Invalid recipient"); uint256 amount=sellerCredit[msg.sender]; require(amount>0,"No credit");
        sellerCredit[msg.sender]=0; totalSellerLiability-=amount;
        (bool ok,)=recipient.call{value:amount}(""); require(ok,"Payment failed"); emit SellerCreditWithdrawn(msg.sender,recipient,amount);
    }
    function flushFees() external onlyAdministrator nonReentrant {
        uint256 amount=pendingFees; require(amount>0,"No fees"); pendingFees=0;
        IFeeRouter(feeRouter).depositFees{value:amount}(); emit FeesFlushed(amount);
    }
    function transferOwnership(address) public pure override { revert("Admin fixed"); }
    function renounceOwnership() public pure override { revert("Admin required"); }
}
