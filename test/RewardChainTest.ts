import { ethers } from "hardhat";
import { expect } from "chai";

function solidityPackHash(types: string[], values: any[]) {
  const packed = ethers.solidityPacked(types, values);
  return ethers.keccak256(packed);
}

describe("RewardChainTest", function () {
  let rewardChain: any;
  let owner: any;

  beforeEach(async function () {
    // Get signers
    [owner] = await ethers.getSigners();

    // Deploy the RewardChain contract
    const startOfStakeChain = ethers.ZeroHash; // Using the null hash as the start
    const RewardChainFactory = await ethers.getContractFactory("RewardChain");
    rewardChain = await RewardChainFactory.deploy(startOfStakeChain);
    await rewardChain.waitForDeployment();
  });

  it("should deploy with correct initial values", async function () {
    const nullHash = ethers.ZeroHash;

    expect(await rewardChain.beginningOfStakeChain()).to.equal(nullHash);
    expect(await rewardChain.currentRewardChain()).to.equal(nullHash);
    expect(await rewardChain.totalRewards()).to.equal(0);
  });

  it("should add rewards and update total rewards and reward chain", async function () {
    const rewardAmount1 = ethers.parseEther("100");
    const rewardAmount2 = ethers.parseEther("50");

    // Add first reward
    let tx = await rewardChain.addRewards(rewardAmount1);
    let receipt = await tx.wait();

    let previousRewardChain = ethers.ZeroHash;
    let currentRewardChain;

    for (const log of receipt.logs) {
      const parsedLog = rewardChain.interface.parseLog(log);
      if (parsedLog.name === "RewardsAdded") {
        console.log("RewardsAdded Event Parameters:", Object.values(parsedLog.args).slice(0, -1));
        currentRewardChain = parsedLog.args.currentRewardChain;
      }
    }

    // Check the total rewards and current reward chain
    expect(await rewardChain.totalRewards()).to.equal(rewardAmount1);
    expect(await rewardChain.currentRewardChain()).to.equal(currentRewardChain);

    // Compute expected reward chain hash
    const timestamp1 = ((await ethers.provider.getBlock(receipt.blockNumber)) as any).timestamp;
    const expectedRewardChain1 = solidityPackHash(
      ["uint256", "uint256", "uint256", "bytes32"],
      [rewardAmount1, rewardAmount1, timestamp1, previousRewardChain]
    );

    expect(currentRewardChain).to.equal(expectedRewardChain1);

    // Add second reward
    tx = await rewardChain.addRewards(rewardAmount2);
    receipt = await tx.wait();

    previousRewardChain = currentRewardChain; // Update to the last reward chain hash

    for (const log of receipt.logs) {
      const parsedLog = rewardChain.interface.parseLog(log);
      if (parsedLog.name === "RewardsAdded") {
        console.log("RewardsAdded Event Parameters:", Object.values(parsedLog.args).slice(0, -1));
        currentRewardChain = parsedLog.args.currentRewardChain;
      }
    }

    // Check the total rewards and current reward chain
    expect(await rewardChain.totalRewards()).to.equal(rewardAmount1 + rewardAmount2);
    expect(await rewardChain.currentRewardChain()).to.equal(currentRewardChain);

    // Compute expected reward chain hash
    const timestamp2 = ((await ethers.provider.getBlock(receipt.blockNumber)) as any).timestamp;
    const expectedRewardChain2 = solidityPackHash(
      ["uint256", "uint256", "uint256", "bytes32"],
      [rewardAmount2, rewardAmount1 + rewardAmount2, timestamp2, previousRewardChain]
    );

    expect(currentRewardChain).to.equal(expectedRewardChain2);
  });

  it("should emit RewardsAdded event with correct parameters", async function () {
    const rewardAmount = ethers.parseEther("100");

    const tx = await rewardChain.addRewards(rewardAmount);
    const receipt = await tx.wait();

    for (const log of receipt.logs) {
      const parsedLog = rewardChain.interface.parseLog(log);
      if (parsedLog.name === "RewardsAdded") {
        const eventArgs = parsedLog.args;

        expect(eventArgs.amount).to.equal(rewardAmount);
        expect(eventArgs.totalRewards).to.equal(rewardAmount);

        const block: any = await ethers.provider.getBlock(receipt.blockNumber);
        expect(eventArgs.timestamp).to.equal(block.timestamp);

        expect(eventArgs.previousRewardChain).to.equal(ethers.ZeroHash);
        expect(eventArgs.currentRewardChain).to.exist;
      }
    }
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
  
});
