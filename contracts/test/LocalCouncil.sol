// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
/// @notice LOCAL TEST ONLY. This is not Safe; production/testnet deployment requires a Safe.
contract LocalCouncil is ReentrancyGuard {
    address[3] public signers;
    mapping(address=>bool) public isSigner;
    struct Proposal {address target;bytes data;uint256 approvals;bool executed;}
    mapping(uint256=>Proposal) private proposals;
    mapping(uint256=>mapping(address=>bool)) public approved;
    uint256 public proposalCount;
    event Proposed(uint256 indexed id,address indexed target,bytes data);
    event Approved(uint256 indexed id,address indexed signer);
    event Executed(uint256 indexed id);
    constructor(address[3] memory owners){require(block.chainid==31337,"Local only");for(uint256 i;i<3;i++){require(owners[i]!=address(0)&&!isSigner[owners[i]],"Invalid signer");signers[i]=owners[i];isSigner[owners[i]]=true;}}
    modifier signer(){require(isSigner[msg.sender],"Not signer");_;}
    function propose(address target,bytes calldata data) external signer returns(uint256 id){require(target.code.length>0 && data.length>=4,"Invalid target");id=++proposalCount;proposals[id]=Proposal(target,data,1,false);approved[id][msg.sender]=true;emit Proposed(id,target,data);emit Approved(id,msg.sender);}
    function approve(uint256 id) external signer {Proposal storage p=proposals[id];require(p.target!=address(0)&&!p.executed&&!approved[id][msg.sender],"Invalid approval");approved[id][msg.sender]=true;p.approvals++;emit Approved(id,msg.sender);}
    function execute(uint256 id) external signer nonReentrant {Proposal storage p=proposals[id];require(p.approvals>=2&&!p.executed,"Threshold/not active");p.executed=true;(bool ok,bytes memory result)=p.target.call(p.data);if(!ok){assembly{revert(add(result,32),mload(result))}}emit Executed(id);}
    function getProposal(uint256 id) external view returns(Proposal memory){return proposals[id];}
    receive() external payable {}
}
