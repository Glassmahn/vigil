import { ethers } from "hardhat";

const ERC8004_IDENTITY_REGISTRY = process.env.ERC8004_IDENTITY_REGISTRY || "";

const IDENTITY_REGISTRY_ABI = [
  "function register(string calldata name, string calldata description, string calldata endpoint, bytes calldata metadata) external returns (uint256 tokenId)",
  "function agentOf(uint256 tokenId) external view returns (tuple(uint256 id, address owner, string name, string description, string endpoint, bool active, uint256 registeredAt))",
  "function balanceOf(address owner) external view returns (uint256)",
];

async function main() {
  const network = await ethers.provider.getNetwork();
  const isMainnet = network.chainId === 5000n;
  console.log(`Deploying Vigil contracts to Mantle (chainId: ${network.chainId})${isMainnet ? " [MAINNET]" : ""}...`);

  const deployer = (await ethers.getSigners())[0];
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", balance.toString());

  const gasOverrides = isMainnet ? {
    maxPriorityFeePerGas: ethers.parseUnits("0.1", "gwei"),
    maxFeePerGas: ethers.parseUnits("0.5", "gwei"),
  } : {};

  const DecisionLog = await ethers.getContractFactory("DecisionLog");
  const decisionLog = await DecisionLog.deploy(gasOverrides);
  await decisionLog.waitForDeployment();
  const decisionLogAddr = await decisionLog.getAddress();
  console.log("DecisionLog deployed to:", decisionLogAddr);

  const VigilRegistry = await ethers.getContractFactory("VigilRegistry");
  const vigilRegistry = await VigilRegistry.deploy(gasOverrides);
  await vigilRegistry.waitForDeployment();
  const vigilRegistryAddr = await vigilRegistry.getAddress();
  console.log("VigilRegistry deployed to:", vigilRegistryAddr);

  console.log("\n---");
  console.log("DecisionLog:", decisionLogAddr);
  console.log("VigilRegistry:", vigilRegistryAddr);
  console.log("---\n");

  const agentId = ethers.keccak256(ethers.toUtf8Bytes("vigil"));
  const tx = await decisionLog.registerAgent(agentId, "Vigil", gasOverrides);
  await tx.wait();
  console.log("Vigil agent registered in DecisionLog with ID:", agentId);

  const tx2 = await vigilRegistry.createAgent(agentId, "Vigil", 1, gasOverrides);
  await tx2.wait();
  console.log("Vigil agent registered in VigilRegistry");

  // Register in ERC-8004 Identity Registry if configured
  if (ERC8004_IDENTITY_REGISTRY) {
    try {
      const identityRegistry = new ethers.Contract(ERC8004_IDENTITY_REGISTRY, IDENTITY_REGISTRY_ABI, deployer);
      const metadata = ethers.toUtf8Bytes(JSON.stringify({
        agentId: agentId,
        riskTiers: ["Safe", "Balanced", "Aggressive"],
        chains: ["Mantle", "Solana"],
        tools: ["Byreal Agent Skills CLI", "Byreal Perps CLI"],
        decisionLog: decisionLogAddr,
        vigilRegistry: vigilRegistryAddr,
      }));
      const tx3 = await identityRegistry.register("Vigil", "Autonomous Personal Yield Agent", process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:3001", metadata, gasOverrides);
      await tx3.wait();
      console.log("Vigil registered in ERC-8004 Identity Registry");
    } catch (e) {
      console.log("ERC-8004 registration skipped:", (e as Error).message);
    }
  } else {
    console.log("ERC8004_IDENTITY_REGISTRY not set — skipping ERC-8004 registration.");
  }

  console.log("\nDeployment complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
