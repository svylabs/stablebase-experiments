pragma solidity ^0.8.20;

interface IStakeChain {
    function stakeChainSnapshot(
        address
    ) external view returns (uint256, bytes32, bytes32);
}

interface IRewardChain {
    function relay(
        address user,
        bytes32 stakeChainSnapshot,
        bytes32 currentStakeChainSnapshot
    ) external;
}

contract StakeRelayer {
    IStakeChain public stakeChain;
    IRewardChain public rewardChain;

    constructor(address _stakeChain, address _rewardChain) {
        stakeChain = IStakeChain(_stakeChain);
        rewardChain = IRewardChain(_rewardChain);
    }

    function relay(address user) external {
        (
            uint256 totalStake,
            bytes32 userStakeChainSnapshot,
            bytes32 currentStakeChainSnapshot
        ) = stakeChain.stakeChainSnapshot(user);
        rewardChain.relay(
            user,
            userStakeChainSnapshot,
            currentStakeChainSnapshot
        );
    }
}
