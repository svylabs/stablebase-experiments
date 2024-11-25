import { ethers } from "hardhat";
import { expect } from "chai";
import { time } from '@nomicfoundation/hardhat-network-helpers';

function solidityPackHash(types: string[], values: any[]) {
  const packed = ethers.solidityPacked(types, values);
  return ethers.keccak256(packed);
}

describe("StakeChain", function () {
  let stakeChain: any;
  let stakingToken: any;
  let owner: any;
  let user: any;
  let addrs: any[];

  beforeEach(async function () {
    // Get signers
    [owner, user, ...addrs] = await ethers.getSigners();

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

    await stakingToken.connect(owner).transfer(user.address, ethers.parseEther("10000"));

    // Approve the StakeChain contract to spend tokens
    await stakingToken.connect(owner).approve(stakeChain.target, ethers.parseEther("1000"));
    await stakingToken.connect(user).approve(stakeChain.target, ethers.parseEther("1000"));
  });

  it("should deploy with correct initial values", async function () {
    expect(await stakeChain.totalStaked()).to.equal(0);
    expect(await stakeChain.stakingToken()).to.equal(stakingToken.target);
    expect(await stakeChain.stakeChain()).to.equal(ethers.ZeroHash);
  });

  it("should allow staking tokens", async function () {
    const stakeAmount = ethers.parseEther("100");

    
    const tx = await stakeChain.connect(owner).stake(stakeAmount);
    const receipt = await tx.wait();
    console.log(receipt);
    let timestamp;
    for (const log of receipt.logs) {
      const parsedLog = stakeChain.interface.parseLog(log);
      console.log(parsedLog);
      if (parsedLog.name === "StakeChainExtended") {
        timestamp = parsedLog.args.timestamp;
      }
    }

    // Check balances
    const totalStaked = await stakeChain.totalStaked();
    const result = await stakeChain.stakeSnapshot(owner.address);

    const hash = solidityPackHash(
        ["address", "bool", "uint256", "uint256", "uint256", "uint256", "bytes32"],
        [owner.address, false, stakeAmount, totalStaked, result[0], timestamp, ethers.ZeroHash]
    )


    expect(totalStaked).to.equal(stakeAmount);
    expect(result[0]).to.equal(stakeAmount);
  });

  it("should allow unstaking tokens", async function () {
    const stakeAmount = ethers.parseEther("100");
    const unstakeAmount = ethers.parseEther("50");

    // Stake tokens first
    const tx = await stakeChain.connect(owner).stake(stakeAmount);
    const receipt = await tx.wait();

    const result1 = await stakeChain.stakeSnapshot(owner.address);

    const tx2 = await stakeChain.connect(owner).unstake(unstakeAmount);
    const receipt2 = await tx2.wait();
    let timestamp;
    for (const log of receipt2.logs) {
      const parsedLog = stakeChain.interface.parseLog(log);
      console.log(parsedLog);
      if (parsedLog.name === "StakeChainExtended") {
        timestamp = parsedLog.args.timestamp;
      }
    }

    // Check balances
    const totalStaked = await stakeChain.totalStaked();
    const result = await stakeChain.stakeSnapshot(owner.address);

    const hash = solidityPackHash(
        ["address", "bool", "uint256", "uint256", "uint256", "uint256", "bytes32"],
        [owner.address, false, unstakeAmount, totalStaked, result[0], timestamp, result1[2]]
    )

    console.log(result[2], result[1]);

    expect(result[1]).to.equal(hash);
    expect(result[2]).to.equal(hash);

    expect(totalStaked).to.equal(ethers.parseEther("50"));
    expect(result[0]).to.equal(ethers.parseEther("50"));
  });

  it("should not allow unstaking more than staked", async function () {
    const stakeAmount = ethers.parseEther("100");
    const unstakeAmount = ethers.parseEther("150");

    // Stake tokens first
    await stakeChain.connect(owner).stake(stakeAmount);

    // Attempt to unstake more than staked
    await expect(stakeChain.connect(owner).unstake(unstakeAmount)).to.be.reverted;
  });

  it("should correctly track stake chain hashes", async function () {
    const stakeAmount = ethers.parseEther("100");
    const unstakeAmount = ethers.parseEther("50");

    // Stake tokens
    await stakeChain.connect(owner).stake(stakeAmount);
    const firstStakeChain = await stakeChain.stakeChain();

    // Unstake tokens
    await stakeChain.connect(owner).unstake(unstakeAmount);
    const secondStakeChain = await stakeChain.stakeChain();

    expect(firstStakeChain).to.not.equal(secondStakeChain);

    // Check user-specific stake snapshot
    const { stakeChainSnapshot } = await stakeChain.stakeSnapshot(owner.address);
    expect(stakeChainSnapshot).to.equal(secondStakeChain);
  });


  it("should stake and unstake randomly, checking hashes and logging event parameters", async function () {
    const [own, ...usrs] = await ethers.getSigners();
    const iterations = 100;
    const maxStakeAmount = ethers.parseEther("100");
    let lastStakeChainHash = ethers.ZeroHash;

    const balances: any = {};

    for (let i = 0;i<usrs.length;i++) {
        const tx = await stakingToken.connect(owner).transfer(usrs[i].address, ethers.parseEther("1000"));
        await tx.wait();
        balances[usrs[i].address] = {
            balance: ethers.parseEther("1000"),
            staked: ethers.parseEther("0")
        };
    }


  
    for (let i = 0; i < iterations; i++) {
      const userId = Math.floor((Math.random() * 1000)) % usrs.length;
      let isStake = Math.random() > 0.5; // Randomly decide to stake or unstake
      const amount = ethers.parseEther((Math.random() * 10).toFixed(2)); // Random amount (up to 10)

      if (!isStake && (balances[usrs[userId].address].staked - amount) <= BigInt(0)) {
        isStake = true; // If no stake, stake instead
      }
      if (isStake && (balances[usrs[userId].address].balance - amount) <= BigInt(0)) {
        isStake = false; // If no balance, unstake instead
      }
      

      time.increase(60 * 60 * 24 * 7); // Increase time by 1 week
  
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
        const totalStaked = await stakeChain.totalStaked();
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
        const totalStaked = await stakeChain.totalStaked();
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
      }
  
      console.log(`Current StakeChain Hash: ${lastStakeChainHash}`);
    }
  });
  
});
