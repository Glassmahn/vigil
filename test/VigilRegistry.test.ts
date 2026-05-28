import { expect } from "chai";
import { ethers } from "hardhat";
import { VigilRegistry } from "../typechain-types";

describe("VigilRegistry", function () {
  let registry: VigilRegistry;
  const agentId = ethers.keccak256(ethers.toUtf8Bytes("vigil"));

  beforeEach(async function () {
    const factory = await ethers.getContractFactory("VigilRegistry");
    registry = await factory.deploy() as unknown as VigilRegistry;
  });

  it("should create an agent", async function () {
    await registry.createAgent(agentId, "Vigil", 1);
    const config = await registry.getAgentById(agentId);
    expect(config.name).to.equal("Vigil");
    expect(config.riskTier).to.equal(1);
    expect(config.active).to.be.true;
  });

  it("should update risk tier", async function () {
    await registry.updateRiskTier(agentId, 2);
    const config = await registry.getAgentById(agentId);
    expect(config.riskTier).to.equal(2);
  });

  it("should log performance", async function () {
    await registry.logPerformance(agentId, 100, 1000);
    const config = await registry.getAgentById(agentId);
    expect(config.totalTrades).to.equal(1);
    expect(config.totalPnl).to.equal(100);
    expect(config.totalValueManaged).to.equal(1000);
  });

  it("should toggle active state", async function () {
    await registry.toggleActive(agentId);
    const config = await registry.getAgentById(agentId);
    expect(config.active).to.be.false;
  });

  it("should reject invalid risk tier", async function () {
    await expect(
      registry.updateRiskTier(agentId, 5)
    ).to.be.revertedWith("Invalid risk tier");
  });

  it("should not allow non-owner to update", async function () {
    const [, other] = await ethers.getSigners();
    await expect(
      registry.connect(other).logPerformance(agentId, 1, 1)
    ).to.be.revertedWith("Not agent owner");
  });
});
