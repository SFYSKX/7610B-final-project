// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "./AdminAccess.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IReserveDeposit { function deposit() external payable; }
contract FeeRouter is AdminAccess, ReentrancyGuard {
    uint256 public constant API_VERSION = 2;
    address payable public immutable treasury;
    uint256 public immutable reserveShareBps;
    address public reserve;
    uint256 public treasuryCredit;
    uint256 public reserveCredit;
    event FeesReceived(address indexed from, uint256 amount, uint256 reservePart);
    event ReserveBound(address indexed reserve);
    event TreasuryPaid(uint256 amount);
    event ReservePaid(uint256 amount);
    constructor(address admin, uint256 share) AdminAccess(admin) {
        require(admin.code.length > 0 && share <= 10000, "Invalid config");
        treasury = payable(admin); reserveShareBps = share;
    }
    function setReserveOnce(address target) external onlyOwner {
        require(reserve == address(0) && target.code.length > 0, "Invalid reserve");
        reserve = target; emit ReserveBound(target);
    }
    function depositFees() external payable {
        require(msg.value > 0, "Zero amount");
        uint256 part = msg.value * reserveShareBps / 10000;
        reserveCredit += part; treasuryCredit += msg.value - part;
        emit FeesReceived(msg.sender, msg.value, part);
    }
    function flushReserve() external onlyAdministrator nonReentrant {
        uint256 amount = reserveCredit;
        require(reserve != address(0) && amount > 0, "Nothing to route");
        reserveCredit = 0;
        (bool ok,) = payable(reserve).call{value:amount}(""); require(ok, "Payment failed"); emit ReservePaid(amount);
    }
    function withdrawTreasury() external onlyAdministrator nonReentrant {
        uint256 amount = treasuryCredit; require(amount > 0, "No credit"); treasuryCredit = 0;
        (bool ok,) = treasury.call{value:amount}(""); require(ok, "Payment failed"); emit TreasuryPaid(amount);
    }
    function transferOwnership(address) public pure override { revert("Admin fixed"); }
    function renounceOwnership() public pure override { revert("Admin required"); }
}
