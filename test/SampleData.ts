import { ethers } from "hardhat";
import { expect } from "chai";
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { bigint } from "hardhat/internal/core/params/argumentTypes";

function solidityPackHash(types: string[], values: any[]) {
  const packed = ethers.solidityPacked(types, values);
  return ethers.keccak256(packed);
}

function serializeToRust(key: any, value: any) {
    //console.log(key, value);
    if (key === "timestamp") {
        return bigintToU256Array(value);
    }
    if (key === "amount") {
        return bigintToU256Array(value);
    }
    if (key === "totalRewards") {
        return bigintToU256Array(value);
    }
    if (key === "totalStaked") {
        return bigintToU256Array(value);
    }
    if (key === "totalUserStake") {
        return bigintToU256Array(value);
    }
    if (key === "previousStakeChain") {
        return hexToByteArray(value.substring(2), 32);
    }
    if (key === "currentStakeChain") {
        return hexToByteArray(value.substring(2), 32);
    }
    if (key === "previousRewardChain") {
        return hexToByteArray(value.substring(2), 32);
    }
    if (key === "currentRewardChain") {
        return hexToByteArray(value.substring(2), 32);
    }
    if (key === "user") {
        return hexToByteArray(value.substring(2), 20);
    }
    if (key === "isStake") {
        return value ? 1 : 0;
    }
    return value;
}

// Helper function: Convert BigInt to U256 array representation (4 x 64-bit integers)
function bigintToU256Array(value: any) {
    const mask = BigInt("0xFFFFFFFFFFFFFFFF"); // Mask for 64 bits
    const parts = [];
    for (let i = 0; i < 4; i++) {
        parts.push(Number(value & mask)); // Extract 64 bits as a number
        value >>= BigInt(64); // Shift right by 64 bits
    }
    return parts;
}

// Helper function: Convert hex string to a byte array of a fixed length
function hexToByteArray(hex: any, length: any) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    if (bytes.length !== length) {
        throw new Error(`Hex string does not match required length of ${length} bytes`);
    }
    return bytes;
}

describe("SampleData", function () {
  let rewardChain: any;
  let owner: any;
  let addrs: any;
  let stakingToken: any;
  let stakeChain: any;

  beforeEach(async function () {
    // Get signers
    [owner, ...addrs] = await ethers.getSigners();
    // Deploy a mock ERC20 token to act as the staking token
    const ERC20MockFactory = await ethers.getContractFactory("MockERC20");
    stakingToken = (await ERC20MockFactory.deploy("MockToken", "MTK"));
    await stakingToken.waitForDeployment();

    // Mint tokens to owner and user
    //await stakingToken.mint(owner.address, ethers.parseEther("1000"));
    //await stakingToken.mint(user.address, ethers.parseEther("1000"));

    // Deploy the StakeChain contract with the staking token address
    const StakeChainFactory = await ethers.getContractFactory("StakeChain");
    stakeChain = (await StakeChainFactory.deploy(stakingToken.target));
    await stakeChain.waitForDeployment();

    // Approve the StakeChain contract to spend tokens
    await stakingToken.connect(owner).approve(stakeChain.target, ethers.parseEther("1000"));

    const startOfStakeChain = ethers.ZeroHash; // Using the null hash as the start
    const RewardChainFactory = await ethers.getContractFactory("RewardChain");
    rewardChain = await RewardChainFactory.deploy(startOfStakeChain);
    await rewardChain.waitForDeployment();
  });

  it("should add multiple random rewards and validate hashes", async function () {
    const iterations = 5; // Number of random reward additions
    let totalRewards = ethers.parseEther("0");
    let previousRewardChain = ethers.ZeroHash;
  
    for (let i = 0; i < iterations; i++) {
      // Generate a random reward amount
      const rewardAmount = ethers.parseEther((Math.random() * 100).toFixed(2)); // Up to 100 tokens
  
      console.log(`Iteration ${i + 1}: Adding reward of ${ethers.formatEther(rewardAmount)} tokens`);
  
      // Add rewards to the contract
      const tx = await rewardChain.addRewards(rewardAmount);
      const receipt = await tx.wait();
  
      let currentRewardChain;
      let timestamp;
  
      for (const log of receipt.logs) {
        const parsedLog = rewardChain.interface.parseLog(log);
        if (parsedLog.name === "RewardsAdded") {
          console.log("RewardsAdded Event Parameters:", Object.values(parsedLog.args).slice(0, -1));
          currentRewardChain = parsedLog.args.currentRewardChain;
          timestamp = parsedLog.args.timestamp;
        }
      }
  
      // Update total rewards
      totalRewards = totalRewards + rewardAmount;
  
      // Compute expected reward chain hash
      const expectedRewardChain = solidityPackHash(
        ["uint256", "uint256", "uint256", "bytes32"],
        [rewardAmount, totalRewards, timestamp, previousRewardChain]
      );
  
      // Validate the state of the contract
      expect(await rewardChain.totalRewards()).to.equal(totalRewards);
      expect(await rewardChain.currentRewardChain()).to.equal(expectedRewardChain);
  
      // Update for the next iteration
      previousRewardChain = currentRewardChain;
    }
  });

  it("should stake and unstake randomly, checking hashes and logging event parameters", async function () {
    const [own, ...usrs] = await ethers.getSigners();
    const iterations = 100;
    const maxStakeAmount = ethers.parseEther("100");
    let lastStakeChainHash = ethers.ZeroHash;
    let totalRewards = ethers.parseEther("0");
    let previousRewardChain = ethers.ZeroHash;
    let stakes = [];
    let rewards = [];
    let totalStaked = BigInt(0);

    const balances: any = {};

    let fromStakeChainEvent;
    let toStakeChainEvent;
    let fromRewardChainEvent;
    let toRewardChainEvent;
    let fromUserStakeChainEvent;
    let toUserStakeChainEvent;
    let user;
    let expectedRewards = BigInt(0);
    let userRewardEvents = [];

    for (let i = 0;i<usrs.length;i++) {
        const tx = await stakingToken.connect(owner).transfer(usrs[i].address, ethers.parseEther("1000"));
        await tx.wait();
        if (Math.random() < 0.1  && user === undefined) {
            user = usrs[i].address;
        }
        balances[usrs[i].address] = {
            balance: ethers.parseEther("1000"),
            staked: ethers.parseEther("0")
        };
    }


  
    for (let i = 0; i < iterations; i++) {
        const random = Math.random();
        const timeIncrease = Math.floor(Math.random() * 86400);
        time.increase(timeIncrease); // Increase time by 1 week
        if (random > 0.33 || totalStaked === BigInt(0)) {
            let isStake = Math.random() > 0.5; // Randomly decide to stake or unstake
                const userId = Math.floor((Math.random() * 1000)) % usrs.length;
                
                const amount = ethers.parseEther((Math.random() * 10).toFixed(2)); // Random amount (up to 10)

                if (!isStake && (balances[usrs[userId].address].staked - amount) <= BigInt(0)) {
                    isStake = true; // If no stake, stake instead
                }
                if (isStake && (balances[usrs[userId].address].balance - amount) <= BigInt(0)) {
                    isStake = false; // If no balance, unstake instead
                }
                
            
                // Get current user snapshot
                const userSnapshot = await stakeChain.stakeSnapshot(usrs[userId].address);
            
                if (isStake) {
                    console.log(`Iteration ${i + 1}: ${usrs[userId].address}, ${balances[usrs[userId].address].balance}, ${balances[usrs[userId].address].staked}, Staking ${ethers.formatEther(amount)} tokens, ${amount}`);
                    const tx = await stakeChain.connect(usrs[userId]).stake(amount);
                    const receipt = await tx.wait();
            
                    // Log the StakeChainExtended event parameters
                    for (const log of receipt.logs) {
                    const parsedLog = stakeChain.interface.parseLog(log);
                    if (parsedLog.name === "StakeChainExtended") {
                        console.log("StakeChainExtended Event Parameters:", Object.values(parsedLog.args));
                    }
                    }
            
                    // Validate the hash
                    totalStaked = await stakeChain.totalStaked();
                    const newUserSnapshot = await stakeChain.stakeSnapshot(usrs[userId].address);
            
                    const stakeTimestamp = receipt.logs
                    .map((log: any) => stakeChain.interface.parseLog(log))
                    .find((parsedLog: any) => parsedLog.name === "StakeChainExtended").args.timestamp;
                    console.log(stakeTimestamp);
            
                    const expectedHash = solidityPackHash(
                    ["address", "bool", "uint256", "uint256", "uint256", "uint256", "bytes32"],
                    [usrs[userId].address, true, amount, totalStaked, newUserSnapshot[0], stakeTimestamp, lastStakeChainHash]
                    );
            
                    expect(newUserSnapshot[2]).to.equal(expectedHash);
                    lastStakeChainHash = newUserSnapshot[2];
                    balances[usrs[userId].address].balance -= amount;
                    balances[usrs[userId].address].staked += amount;
                    stakes.push({
                        user: usrs[userId].address,
                        isStake: true,
                        amount: amount,
                        totalStaked: totalStaked,
                        totalUserStake: newUserSnapshot[0],
                        timestamp: stakeTimestamp,
                        previousStakeChain: lastStakeChainHash,
                        currentStakeChain: newUserSnapshot[2]
                    })
                } else {
                    console.log(`Iteration ${i + 1}:  ${usrs[userId].address}, ${balances[usrs[userId].address].balance}, ${balances[usrs[userId].address].staked}, Unstaking ${ethers.formatEther(amount)} tokens ${amount}`);
                    const totalStake = userSnapshot[0];
                    if (amount > totalStake) {
                    console.log("Not enough stake to unstake, skipping...");
                    continue;
                    }
            
                    const tx = await stakeChain.connect(usrs[userId]).unstake(amount);
                    const receipt = await tx.wait();
            
                    // Log the StakeChainExtended event parameters
                    for (const log of receipt.logs) {
                    const parsedLog = stakeChain.interface.parseLog(log);
                    if (parsedLog.name === "StakeChainExtended") {
                        console.log("StakeChainExtended Event Parameters:", Object.values(parsedLog.args));
                    }
                    }
            
                    // Validate the hash
                    totalStaked = await stakeChain.totalStaked();
                    const newUserSnapshot = await stakeChain.stakeSnapshot(usrs[userId].address);
            
                    const unstakeTimestamp = receipt.logs
                    .map((log: any) => stakeChain.interface.parseLog(log))
                    .find((parsedLog: any) => parsedLog.name === "StakeChainExtended").args.timestamp;
            
                    const expectedHash = solidityPackHash(
                    ["address", "bool", "uint256", "uint256", "uint256", "uint256", "bytes32"],
                    [usrs[userId].address, false, amount, totalStaked, newUserSnapshot[0], unstakeTimestamp, lastStakeChainHash]
                    );
            
                    expect(newUserSnapshot[2]).to.equal(expectedHash);
                    lastStakeChainHash = newUserSnapshot[2];
                    balances[usrs[userId].address].balance += amount;
                    balances[usrs[userId].address].staked -= amount;
                    stakes.push({
                        user: usrs[userId].address,
                        isStake: false,
                        amount: amount,
                        totalStaked: totalStaked,
                        totalUserStake: newUserSnapshot[0],
                        timestamp: unstakeTimestamp,
                        previousStakeChain: lastStakeChainHash,
                        currentStakeChain: newUserSnapshot[2]
                    })
                    
                }
                if (Math.random() < 0.1 && toStakeChainEvent === undefined) {
                    fromStakeChainEvent = stakes[stakes.length - 1];
                    for (let j = stakes.length - 1;j>=0;j--) {
                        if (stakes[j].user === user) {
                            fromUserStakeChainEvent = stakes[j];
                            break;
                        }
                    }
                }
                if (Math.random() < 0.1 && toStakeChainEvent === undefined) {
                    toStakeChainEvent = stakes[stakes.length - 1];
                    for (let j = stakes.length - 1;j>=0;j--) {
                        if (stakes[j].user === user) {
                            toUserStakeChainEvent = stakes[j];
                            break;
                        }
                    }
                }
            
                console.log(`Current StakeChain Hash: ${lastStakeChainHash}`);
             } else {


                const rewardAmount = ethers.parseEther((Math.random() * 100).toFixed(2)); // Up to 100 tokens
            
                console.log(`Iteration ${i + 1}: Adding reward of ${ethers.formatEther(rewardAmount)} tokens`);
            
                // Add rewards to the contract
                const tx = await rewardChain.addRewards(rewardAmount);
                const receipt = await tx.wait();
            
                let currentRewardChain;
                let timestamp;
            
                for (const log of receipt.logs) {
                    const parsedLog = rewardChain.interface.parseLog(log);
                    if (parsedLog.name === "RewardsAdded") {
                    console.log("RewardsAdded Event Parameters:", Object.values(parsedLog.args).slice(0, -1));
                    currentRewardChain = parsedLog.args.currentRewardChain;
                    timestamp = parsedLog.args.timestamp;
                    }
                }
            
                // Update total rewards
                totalRewards = totalRewards + rewardAmount;
            
                // Compute expected reward chain hash
                const expectedRewardChain = solidityPackHash(
                    ["uint256", "uint256", "uint256", "bytes32"],
                    [rewardAmount, totalRewards, timestamp, previousRewardChain]
                );
            
                // Validate the state of the contract
                expect(await rewardChain.totalRewards()).to.equal(totalRewards);
                expect(await rewardChain.currentRewardChain()).to.equal(expectedRewardChain);
                rewards.push({
                    amount: rewardAmount,
                    totalRewards: totalRewards,
                    timestamp: timestamp,
                    previousRewardChain: previousRewardChain,
                    currentRewardChain: currentRewardChain
                })
            
                // Update for the next iteration
                previousRewardChain = currentRewardChain;

                if (Math.random() < 0.1 && fromRewardChainEvent === undefined) {
                    fromRewardChainEvent = rewards[rewards.length - 1];
                }
                if (Math.random() < 0.1 && fromRewardChainEvent !== undefined && toRewardChainEvent === undefined) {
                    toRewardChainEvent = rewards[rewards.length - 1];
                }
                if (fromRewardChainEvent !== undefined && toRewardChainEvent === undefined && user !== undefined) {
                    expectedRewards += (rewardAmount * balances[user].staked) / totalStaked;
                    userRewardEvents.push({
                        rewardEvent: rewards[rewards.length - 1],
                        userStake: balances[user].staked,
                        totalStaked: totalStaked
                    });
                }
            }
    }
    if (toRewardChainEvent === undefined) {
        toRewardChainEvent = rewards[rewards.length - 1];
    }
    if (toStakeChainEvent === undefined) {
        toStakeChainEvent = stakes[stakes.length - 1];
        for (let j = stakes.length - 1;j>=0;j--) {
            if (stakes[j].user === user) {
                toUserStakeChainEvent = stakes[j];
                break;
            }
        }
    }
    console.log("=====================================");
    console.log(JSON.stringify(stakes, serializeToRust));
    console.log("=====================================");
    console.log(JSON.stringify(rewards, serializeToRust));
    let claim: any = {};
    claim.user = user;
    if (fromStakeChainEvent !== undefined) {
        claim.fromStakeChainEvent = fromStakeChainEvent;
    }
    if (toStakeChainEvent !== undefined) {
        claim.toStakeChainEvent = toStakeChainEvent;
    }
    if (fromRewardChainEvent !== undefined) {
        claim.fromRewardChainEvent = fromRewardChainEvent;
    }
    if (toRewardChainEvent !== undefined) {
        claim.toRewardChainEvent = toRewardChainEvent;
    }
    if (fromUserStakeChainEvent !== undefined) {
        claim.fromUserStakeChainEvent = fromUserStakeChainEvent;
    }
    if (toUserStakeChainEvent !== undefined) {
        claim.toUserStakeChainEvent = toUserStakeChainEvent;
    }
    const json = {
        user: user,
        stake_events: stakes,
        reward_events: rewards,
        claim: claim
    }
    console.log("=====================================");
    console.log(JSON.stringify(json, serializeToRust));
    console.log("================================");
    console.log("Expected rewards", expectedRewards.toString());
    const expected = {
        user: user,
        totalRewards: expectedRewards,
        fromRewardChainHash: fromRewardChainEvent ? fromRewardChainEvent.currentRewardChain : "0x0",
        toRewardChainHash: toRewardChainEvent ? toRewardChainEvent.currentRewardChain : "0x0",
        fromStakeChainHash: fromStakeChainEvent ? fromStakeChainEvent.currentStakeChain : "0x0",
        toStakeChainHash: toStakeChainEvent ? toStakeChainEvent.currentStakeChain : "0x0",
        fromUserStakeChain: fromUserStakeChainEvent ? fromUserStakeChainEvent.currentStakeChain : "0x0",
        toUserStakeChain: toUserStakeChainEvent ? toUserStakeChainEvent.currentStakeChain : "0x0",
        userRewardEvents: userRewardEvents
    }
    console.log(JSON.stringify(expected, (k, v) => { if (typeof v === "bigint") return v.toString(); return v; }));
  });



});
