// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "./AdminAccess.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract RiskReserve is AdminAccess, ReentrancyGuard {
    uint256 public constant API_VERSION=2;
    struct Incident { bytes32 policyHash; uint256 budget; uint256 approved; uint256 paid; uint64 claimDeadline; uint64 reviewDeadline; bool closed; }
    enum State { None, Registered, Submitted, Approved, Rejected, Paid }
    struct Claim { uint256 incidentId; bytes32 lossKey; address beneficiary; uint256 maxLoss; uint256 amount; bytes32 evidenceHash; bytes32 reasonHash; State state; }
    error InvalidPolicy();
    error InvalidBudget();
    error InsufficientBudget(uint256 requested, uint256 availableAmount);
    uint256 public incidentCount;
    uint256 public claimCount;
    uint256 public totalIncidentReserved;
    bool public paused;
    mapping(uint256=>Incident) private incidents;
    mapping(uint256=>Claim) private claims;
    mapping(bytes32=>bool) public registeredLoss;
    event Deposited(address indexed from,uint256 amount);
    event IncidentOpened(uint256 indexed id,bytes32 policyHash,uint256 budget,uint64 claimDeadline,uint64 reviewDeadline);
    event EntitlementRegistered(uint256 indexed claimId,uint256 indexed incidentId,address indexed beneficiary,bytes32 lossKey,uint256 maxLoss);
    event ClaimSubmitted(uint256 indexed id,bytes32 evidenceHash);
    event ClaimApproved(uint256 indexed id,uint256 amount);
    event ClaimRejected(uint256 indexed id,bytes32 reasonHash);
    event IncidentClosed(uint256 indexed id,uint256 released);
    event PayoutClaimed(uint256 indexed id,address indexed beneficiary,address recipient,uint256 amount);
    event PauseConfigured(bool paused);
    constructor(address admin) AdminAccess(admin){require(admin.code.length>0,"Contract admin required");}
    modifier live(){require(!paused,"New business paused");_;}
    function deposit() external payable onlyAdministrator {require(msg.value>0,"Zero amount");emit Deposited(msg.sender,msg.value);}
    receive() external payable {emit Deposited(msg.sender,msg.value);}
    function available() public view returns(uint256){return address(this).balance-totalIncidentReserved;}
    function getIncident(uint256 id) external view returns(Incident memory){return incidents[id];}
    function getClaim(uint256 id) external view returns(Claim memory){return claims[id];}
    function setPaused(bool value) external onlyOwner {paused=value;emit PauseConfigured(value);}
    function openIncident(bytes32 policyHash,uint256 budget,uint64 claimDeadline,uint64 reviewDeadline) external onlyOwner live returns(uint256 id){
        if(policyHash==bytes32(0)) revert InvalidPolicy();
        if(budget==0) revert InvalidBudget();
        if(budget>available()) revert InsufficientBudget(budget,available());
        require(claimDeadline>block.timestamp && reviewDeadline>claimDeadline && reviewDeadline<=block.timestamp+365 days,"Invalid deadlines");
        totalIncidentReserved+=budget;id=++incidentCount;incidents[id]=Incident(policyHash,budget,0,0,claimDeadline,reviewDeadline,false);
        emit IncidentOpened(id,policyHash,budget,claimDeadline,reviewDeadline);
    }
    function registerEntitlement(uint256 incidentId,bytes32 lossKey,address beneficiary,uint256 maxLoss) external onlyOwner live returns(uint256 id){
        Incident storage i=incidents[incidentId];require(block.timestamp<i.claimDeadline && !i.closed,"Registration closed");
        require(lossKey!=bytes32(0) && !registeredLoss[lossKey] && beneficiary!=address(0) && maxLoss>0 && maxLoss<=i.budget,"Invalid entitlement");
        registeredLoss[lossKey]=true;id=++claimCount;claims[id]=Claim(incidentId,lossKey,beneficiary,maxLoss,0,0,0,State.Registered);
        emit EntitlementRegistered(id,incidentId,beneficiary,lossKey,maxLoss);
    }
    function submitClaim(uint256 id,bytes32 evidenceHash) external live {
        Claim storage c=claims[id];Incident storage i=incidents[c.incidentId];
        require(c.beneficiary==msg.sender && c.state==State.Registered,"Not eligible");require(!i.closed && block.timestamp<i.claimDeadline && evidenceHash!=bytes32(0),"Invalid submission");
        c.evidenceHash=evidenceHash;c.state=State.Submitted;emit ClaimSubmitted(id,evidenceHash);
    }
    function approveClaim(uint256 id,uint256 amount) external onlyOwner live {
        Claim storage c=claims[id];Incident storage i=incidents[c.incidentId];require(c.state==State.Submitted && !i.closed && block.timestamp<i.reviewDeadline,"Review closed");
        require(amount>0 && amount<=c.maxLoss && i.approved+amount<=i.budget,"Over budget");i.approved+=amount;c.amount=amount;c.state=State.Approved;emit ClaimApproved(id,amount);
    }
    function rejectClaim(uint256 id,bytes32 reasonHash) external onlyOwner {
        Claim storage c=claims[id];Incident storage i=incidents[c.incidentId];require(c.state==State.Submitted && !i.closed && block.timestamp<i.reviewDeadline,"Review closed");
        require(reasonHash!=bytes32(0),"Reason required");c.reasonHash=reasonHash;c.state=State.Rejected;emit ClaimRejected(id,reasonHash);
    }
    function closeIncident(uint256 id) external onlyAdministrator {
        Incident storage i=incidents[id];require(i.budget>0 && !i.closed && block.timestamp>=i.reviewDeadline,"Not ready");
        i.closed=true;uint256 released=i.budget-i.approved;totalIncidentReserved-=released;emit IncidentClosed(id,released);
    }
    function claimPayout(uint256 id,address payable recipient) external nonReentrant {
        Claim storage c=claims[id];require(c.beneficiary==msg.sender && c.state==State.Approved,"No entitlement");
        require(recipient!=address(0),"Invalid recipient");c.state=State.Paid;incidents[c.incidentId].paid+=c.amount;totalIncidentReserved-=c.amount;
        (bool ok,)=recipient.call{value:c.amount}("");require(ok,"Payment failed");emit PayoutClaimed(id,msg.sender,recipient,c.amount);
    }
    function transferOwnership(address) public pure override {revert("Admin fixed");}
    function renounceOwnership() public pure override {revert("Admin required");}
}
