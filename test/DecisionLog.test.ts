import { expect } from "chai";
import { ethers } from "hardhat";
import { DecisionLog, VigilRegistry } from "../typechain-types";

describe("DecisionLog", function () {
  let decisionLog: DecisionLog;
  let owner: any, addr1: any;
  const agentId = ethers.keccak256(ethers.toUtf8Bytes("test-agent"));

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("DecisionLog");
    decisionLog = await factory.deploy();
    await decisionLog.waitForDeployment();
  });

  it("should register an agent", async function () {
    await decisionLog.registerAgent(agentId, "TestAgent");
    expect(await decisionLog.registeredAgents(agentId)).to.equal(true);
    expect(await decisionLog.agentNames(agentId)).to.equal("TestAgent");
    expect(await decisionLog.agentOwners(agentId)).to.equal(owner.address);
  });

  it("should not register duplicate agent", async function () {
    await decisionLog.registerAgent(agentId, "TestAgent");
    await expect(
      decisionLog.registerAgent(agentId, "Duplicate")
    ).to.be.revertedWith("Agent already registered");
  });

  it("should log a decision", async function () {
    await decisionLog.registerAgent(agentId, "TestAgent");
    await decisionLog.logDecision(agentId, "SWAP", '{"from":"USDC","to":"mETH","amount":"100"}');
    expect(await decisionLog.getDecisionCount()).to.equal(1);
    const decision = await decisionLog.getDecision(0);
    expect(decision.action).to.equal("SWAP");
    expect(decision.agentId).to.equal(agentId);
  });

  it("should not log from non-owner", async function () {
    await decisionLog.registerAgent(agentId, "TestAgent");
    await expect(
      decisionLog.connect(addr1).logDecision(agentId, "SWAP", "{}")
    ).to.be.revertedWith("Not agent owner");
  });

  it("should return all agent decisions", async function () {
    await decisionLog.registerAgent(agentId, "TestAgent");
    await decisionLog.logDecision(agentId, "SWAP", '{"a":1}');
    await decisionLog.logDecision(agentId, "STAKE", '{"b":2}');
    const decisions = await decisionLog.getAgentDecisions(agentId);
    expect(decisions.length).to.equal(2);
    expect(decisions[0].action).to.equal("SWAP");
    expect(decisions[1].action).to.equal("STAKE");
  });
});

describe("VigilRegistry", function () {
  let vigilRegistry: VigilRegistry;
  let owner: any;
  const agentId = ethers.keccak256(ethers.toUtf8Bytes("vigil"));

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("VigilRegistry");
    vigilRegistry = await factory.deploy();
    await vigilRegistry.waitForDeployment();
  });

  it("should create an agent", async function () {
    await vigilRegistry.createAgent(agentId, "Vigil", 1);
    const agent = await vigilRegistry.getAgentById(agentId);
    expect(agent.name).to.equal("Vigil");
    expect(agent.riskTier).to.equal(1);
    expect(agent.active).to.equal(true);
  });

  it("should update risk tier", async function () {
    await vigilRegistry.createAgent(agentId, "Vigil", 0);
    await vigilRegistry.updateRiskTier(agentId, 2);
    const agent = await vigilRegistry.getAgentById(agentId);
    expect(agent.riskTier).to.equal(2);
  });

  it("should log performance", async function () {
    await vigilRegistry.createAgent(agentId, "Vigil", 1);
    await vigilRegistry.logPerformance(agentId, 50, 1000);
    const agent = await vigilRegistry.getAgentById(agentId);
    expect(agent.totalTrades).to.equal(1);
    expect(agent.totalPnl).to.equal(50);
    expect(agent.totalValueManaged).to.equal(1000);
  });
});
