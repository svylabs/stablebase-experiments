import { ethers } from "hardhat";
import { expect } from "chai";

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
});
