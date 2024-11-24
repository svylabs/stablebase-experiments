pragma solidity ^0.8.20;

contract RewardChain {
    /**
     * @dev Relay the stakeChainSnapshot and currentStakeChainSnapshot. This messages should come from a trusted / trustless relayer through Rollup inbox.
     *
     * @param user The user address
     * @param userStakeChainSnapshot The userStakeChainSnapshot of the user
     * @param currentStakeChainSnapshot The current StakeChainSnapshot
     */

    struct StakeRewardClaim {
        bytes32 previousStakeChainSnapshot;
        bytes32 currentStakeChainSnapshot;
        bytes32 previousRewardChainSnapshot;
        bytes32 currentRewardChainSnapshot;
        bool claimed;
    }

    bytes32 public NULL_HASH = keccak256(abi.encodePacked(uint256(0)));
    bytes32 public beginningOfStakeChain = NULL_HASH;
    bytes32 public currentRewardChain = NULL_HASH;

    uint256 public totalRewards;

    mapping(address => StakeRewardClaim) public rewards;

    constructor(bytes32 startOfStakeChain) {
        // Initialize the beginning of the stake chain
        beginningOfStakeChain = startOfStakeChain;
    }

    function relay(address user, bytes32 currentStakeChainSnapshot) external {
        // Should relay the stakeChainSnapshot and currentStakeChainSnapshot
        StakeRewardClaim storage claim = rewards[user];
        if (claim.previousStakeChainSnapshot == bytes32(0x0)) {
            claim.previousStakeChainSnapshot = beginningOfStakeChain;
            claim.currentStakeChainSnapshot = currentStakeChainSnapshot;
            claim.previousRewardChainSnapshot = NULL_HASH;
            claim.currentRewardChainSnapshot = currentRewardChain;
        } else {
            require(
                claim.claimed,
                "There is a pending reward claim for the user"
            );
            claim.previousStakeChainSnapshot = claim.currentStakeChainSnapshot;
            claim.currentStakeChainSnapshot = currentStakeChainSnapshot;
            claim.claimed = false;
            claim.previousRewardChainSnapshot = claim
                .currentRewardChainSnapshot;
            claim.currentRewardChainSnapshot = currentRewardChain;
        }
    }

    function addRewards() public {
        // Should add rewards to the contract
    }

    function initializeClaimRewards(address user) public {
        // Should initialize the claim rewards for the user
        // Should take a snapshot of the current reward chain.
    }

    /**
     * Users should be able to claim rewards by submitting a proof that the calculated reward values are correct for the user based on the snapshot of the stake chain.
     *
     * The users should be able to prove that between the PreviousStakeChainSnapshot and CurrentStakeChainSnapshot, the user had particular stakes at specific times of reward and the final
     * reward value is the aggregate of all the rewards.
     *
     * BeginningOfStakeChain -> PreviousStakeChainSnapshot -> CurrentStakeChainSnapshot
     *
     * Beginning -> PreviousRewardChainSnapshot -> CurrentRewardChainSnapshot
     */
    function claimRewards(
        uint256 aggregateRewards,
        bytes calldata proof
    ) public {
        // Should verify proof and return the rewards
        StakeRewardClaim storage claim = rewards[msg.sender];
        claim.claimed = true;
    }
}