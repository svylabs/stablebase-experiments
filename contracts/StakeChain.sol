pragma solidity ^0.8.20;

contract StakeChain {
    uint256 public totalStaked;
    address public stakingToken;

    bytes32 public constant NULL_HASH = bytes32(0x0);

    // A chain of stake modifications
    bytes32 public stakeChain = NULL_HASH;

    event StakeChainExtended(
        address indexed user,
        bool isStake,
        uint256 amount,
        uint256 totalStaked,
        uint256 totalUserStake,
        uint256 timestamp,
        bytes32 previous,
        bytes32 current
    );

    constructor(address _stakingToken) {
        stakingToken = _stakingToken;
    }

    struct StakeSnapshot {
        uint256 totalStake;
        bytes32 stakeChainSnapshot;
    }

    mapping(address => StakeSnapshot) public stakes;

    function stake(uint256 amount) public {
        // Stake the amount
        // TODO: check the transfer etc..
        totalStaked += amount;
        stakes[msg.sender].totalStake += amount;

        bytes memory stakeData = abi.encodePacked(
            msg.sender,
            true,
            amount,
            totalStaked,
            stakes[msg.sender].totalStake,
            block.timestamp,
            stakeChain
        );
        bytes32 newStakeChain = keccak256(stakeData);
        emit StakeChainExtended(
            msg.sender,
            true,
            amount,
            totalStaked,
            stakes[msg.sender].totalStake,
            block.timestamp,
            stakeChain,
            newStakeChain
        );
        stakeChain = newStakeChain;
        stakes[msg.sender].stakeChainSnapshot = stakeChain;
    }

    function unstake(uint256 amount) public {
        // Unstake the amount
        totalStaked -= amount;
        stakes[msg.sender].totalStake -= amount;

        bytes memory stakeData = abi.encodePacked(
            msg.sender,
            false,
            amount,
            totalStaked,
            stakes[msg.sender].totalStake,
            block.timestamp,
            stakeChain
        );
        bytes32 prevStakeChain = stakeChain;
        stakeChain = keccak256(stakeData);
        stakes[msg.sender].stakeChainSnapshot = stakeChain;
        emit StakeChainExtended(
            msg.sender,
            false,
            amount,
            totalStaked,
            stakes[msg.sender].totalStake,
            block.timestamp,
            prevStakeChain,
            stakeChain
        );
    }

    function stakeSnapshot(
        address user
    )
        public
        view
        returns (
            uint256 totalStake,
            bytes32 stakeChainSnapshot,
            bytes32 currentStakeChain
        )
    {
        return (
            stakes[user].totalStake,
            stakes[user].stakeChainSnapshot,
            stakeChain
        );
    }
}
