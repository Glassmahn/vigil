import { ethers } from "hardhat";

const ERC8004_IDENTITY_REGISTRY = process.env.ERC8004_IDENTITY_REGISTRY || "";
const ERC8004_REPUTATION_REGISTRY = process.env.ERC8004_REPUTATION_REGISTRY || "";

const IDENTITY_REGISTRY_ABI = [
  "function register(string calldata name, string calldata description, string calldata endpoint, bytes calldata metadata) external returns (uint256 tokenId)",
  "function agentOf(uint256 tokenId) external view returns (tuple(uint256 id, address owner, string name, string description, string endpoint, bool active, uint256 registeredAt))",
  "function balanceOf(address owner) external view returns (uint256)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Registering Vigil in ERC-8004 Identity Registry...");
  console.log("Deployer:", deployer.address);

  if (!ERC8004_IDENTITY_REGISTRY) {
    console.log("ERC8004_IDENTITY_REGISTRY not set. Skipping ERC-8004 registration.");
    console.log("To register manually:");
    console.log("  1. Find the ERC-8004 Identity Registry address on Mantle mainnet");
    console.log("  2. Set ERC8004_IDENTITY_REGISTRY in .env");
    console.log("  3. Run this script again");
    return;
  }

  const identityRegistry = new ethers.Contract(
    ERC8004_IDENTITY_REGISTRY,
    IDENTITY_REGISTRY_ABI,
    deployer
  );

  const name = "Vigil";
  const description = "Autonomous Personal Yield Agent. Manages DeFi strategies via Byreal CLIs with on-chain decision logging.";
  const endpoint = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:3001";
  const metadata = ethers.toUtf8Bytes(JSON.stringify({
    agentId: ethers.keccak256(ethers.toUtf8Bytes("vigil")),
    riskTiers: ["Safe", "Balanced", "Aggressive"],
    chains: ["Mantle", "Solana"],
    tools: ["Byreal Agent Skills CLI", "Byreal Perps CLI"],
    createdAt: Math.floor(Date.now() / 1000),
  }));

  console.log("Registering agent identity...");
  const tx = await identityRegistry.register(name, description, endpoint, metadata);
  const receipt = await tx.wait();
  console.log("Agent registered! Tx:", receipt.hash);

  const balance = await identityRegistry.balanceOf(deployer.address);
  console.log("ERC-8004 tokens owned by deployer:", balance.toString());
}

main().catch(console.error);
